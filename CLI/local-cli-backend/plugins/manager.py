from plugins.base import CompletePlugin
import asyncio
import os
import socket
from asyncio import Task
from pathlib import Path
from typing import Dict, List, Union

import httpx
import websockets
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from starlette.requests import Request
from starlette.websockets import WebSocket, WebSocketDisconnect

from plugins.base import InstalledPlugin, LivePlugin, MarketplacePlugin
from plugins.engine import get_plugin_engine
from plugins.exceptions import (
    PluginAppInitializationError,
)
from plugins.installer import install_plugin

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# OFFICIAL_PLUGINS_PATH = Path(BASE_DIR) / "official-plugins"

OFFICIAL_PLUGINS_PATH = (
    Path(os.path.dirname(os.path.abspath(__file__))).parent / "official-plugins"
)

if not OFFICIAL_PLUGINS_PATH.exists():
    OFFICIAL_PLUGINS_PATH.mkdir(parents=True, exist_ok=True)


class PluginManager:
    def __init__(self):
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=5.0))
        self._engine = get_plugin_engine()
        self._app: FastAPI | None = None
        self._redirect_mappings: Dict[str, int] = {}
        self._install_tasks: Dict[str, Task] = {}
        self._install_progress: Dict[str, list[str]] = {}

    def set_app(self, app: FastAPI):
        self._app = app

    def _alloc_port(self) -> int:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("", 0))
            return s.getsockname()[1]

    def get_redirect(self, slug: str) -> Union[int, None]:
        return self._redirect_mappings[slug]

    def set_redirect(self, prefix: str, port: int):
        self._redirect_mappings[prefix] = port
        self._register_route(prefix, port)
        print(f"Enabled redirect '{prefix}' -> {port}")

    async def start_plugin(self, installed: InstalledPlugin):
        if not self._app:
            raise PluginAppInitializationError(
                "No FastAPI app registered within plugin manager"
            )

        port = self._alloc_port()

        await self._engine.start_plugin(installed_plugin=installed, port=port)
        self.set_redirect(installed.core.slug.replace("/", "%2F"), port)
        self.set_redirect(installed.core.manifest.api_prefix.strip("/"), port)

        # return LivePlugin(installed=installed, api_prefix=self._redirect_mappings.get(installed.core.slug, installed.core.slug), internal_port=port, proc_id=proc.pid)

    def get_local_plugins(self) -> List[CompletePlugin]:
        return self._engine.find_local_plugins(OFFICIAL_PLUGINS_PATH)

    def get_live_plugins(self) -> List[LivePlugin]:
        return []
        installed_plugins = self.get_installed_plugins()
        live_plugins: List[LivePlugin] = []

        for installed in installed_plugins:
            proc = self._engine.processes.get(installed.core.slug)
            port = self.get_redirect(installed.core.slug)
            if proc and port:
                live_plugins.append(
                    LivePlugin(
                        installed=installed,
                        api_prefix=self.get_redirect(installed.core.slug),
                        internal_port=port,
                        proc_id=proc.pid,
                    )
                )

        return live_plugins

    def _register_route(self, prefix: str, port: int):
        clean_prefix = prefix.replace("/", "-")

        async def proxy_handler(scope, receive, send):
            # path = scope["path"] if scope["path"].startswith("/") else f"/{scope['path']}"
            path = scope["path"]
            qs = scope.get("query_string", b"").decode()
            url = f"ws://127.0.0.1:{port}{path}"
            if qs:
                url = f"{url}?{qs}"

            print(f"[proxy] type={scope['type']} port={port} path={path!r} url={url}")

            if scope["type"] == "websocket":
                ws = WebSocket(scope, receive, send)
                await ws.accept()
                url = f"ws://127.0.0.1:{port}{path}"
                if qs:
                    url = f"{url}?{qs}"
                try:
                    async with websockets.connect(url) as upstream:

                        async def from_client():
                            while True:
                                message = await ws.receive()
                                if message["type"] == "websocket.disconnect":
                                    await upstream.close()
                                    return
                                if "bytes" in message and message["bytes"]:
                                    await upstream.send(message["bytes"])
                                elif "text" in message and message["text"]:
                                    await upstream.send(message["text"])

                        async def from_upstream():
                            async for message in upstream:
                                if isinstance(message, bytes):
                                    await ws.send_bytes(message)
                                else:
                                    await ws.send_text(message) #type:ignore

                        await asyncio.gather(from_client(), from_upstream())
                except (websockets.ConnectionClosed, WebSocketDisconnect):
                    pass

            else:
                request = Request(scope, receive)
                url = f"http://127.0.0.1:{port}{path}"
                if qs:
                    url = f"{url}?{qs}"
                rp_req = self._client.build_request(
                    method=request.method,
                    url=url,
                    headers={
                        k: v for k, v in request.headers.items() if k.lower() != "host"
                    },
                    content=request.stream(),
                )
                rp_resp = await self._client.send(rp_req, stream=True)
                response = StreamingResponse(
                    rp_resp.aiter_raw(),
                    status_code=rp_resp.status_code,
                    headers=dict(rp_resp.headers),
                    background=rp_resp.aclose, #type:ignore
                )
                await response(scope, receive, send)

        if self._app:
            self._app.mount(f"/{clean_prefix}", app=proxy_handler)
        else:
            raise PluginAppInitializationError(
                "No FastAPI app registered within plugin manager"
            )

    async def stop_plugin(self, slug: str):
        if not self._app:
            raise PluginAppInitializationError(
                "No FastAPI app registered within plugin manager"
            )

        await self._engine.stop_plugin(slug=slug)

        # start_plugin registers encoded slug and manifest api_prefix — remove both.
        self._redirect_mappings.pop(slug.replace("/", "%2F"), None)
        self._redirect_mappings.pop(slug, None)
        for p in self.get_local_plugins():
            if p.core.slug == slug:
                prefix = (p.core.manifest.api_prefix or "").strip("/")
                if prefix:
                    self._redirect_mappings.pop(prefix, None)
                break

    def install_and_track(self, plugin: MarketplacePlugin, plugins_path: Path) -> Task:
        slug = plugin.core.slug
        self._install_progress[slug] = []

        async def on_progress(message: str):
            self._install_progress[slug].append(message)

        task = asyncio.create_task(
            install_plugin(plugin, OFFICIAL_PLUGINS_PATH, on_progress=on_progress)
        )

        self._install_tasks[plugin.core.slug] = task
        return task

    def get_install_tasks(self) -> Dict[str, Task]:
        return self._install_tasks

    def get_install_progress(self, slug: str) -> List[str]:
        return self._install_progress.get(slug, [])
    
    def clear_install_task(self, slug: str):
        self._install_tasks.pop(slug, None)
        self._install_progress.pop(slug, None)


_manager: PluginManager | None = None


def get_plugin_manager() -> PluginManager:
    global _manager
    if _manager is None:
        _manager = PluginManager()

    return _manager
