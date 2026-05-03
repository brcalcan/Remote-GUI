import os
from asyncio import Task
from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, model_validator

import plugins
import plugins.exceptions
from decorators import wrap_sse_stream
from feature_config_loader import (
    disable_plugin_feature,
    enable_plugin_feature,
    resolve_plugin_enabled_from_config,
)
from plugins.base import InstalledPlugin, MarketplacePlugin
from plugins.engine import get_plugin_engine
from plugins.installer import uninstall_plugin
from plugins.loader import get_plugin_order
from plugins.manager import get_plugin_manager

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OFFICIAL_PLUGINS_PATH = Path(BASE_DIR) / "official-plugins"

if not OFFICIAL_PLUGINS_PATH.exists():
    OFFICIAL_PLUGINS_PATH.mkdir(parents=True, exist_ok=True)

plugins_router = APIRouter(prefix="/plugins", tags=["feature-config", "plugins"])
manager = get_plugin_manager()
engine = get_plugin_engine()


def get_plugin_order_config() -> dict:
    plugins_dir = os.path.join(BASE_DIR, "plugins")
    plugin_order = get_plugin_order(plugins_dir)
    return {
        "plugin_order": plugin_order if plugin_order else [],
        "has_custom_order": plugin_order is not None,
    }


class InstallRequest(BaseModel):
    plugin: MarketplacePlugin
    path: str = Field(default=str(OFFICIAL_PLUGINS_PATH))

    @model_validator(mode="before")
    @classmethod
    def flatten_plugin(cls, data):
        if "plugin" not in data:
            plugin_fields = {"name", "id", "version", "download_link"}
            if plugin_fields.issubset(data.keys()):
                data = dict(data)
                data["plugin"] = {k: data.pop(k) for k in plugin_fields}
        return data


class ModificationRequest(BaseModel):
    slug: str


@plugins_router.get("/order")
def get_plugin_order_endpoint():
    return get_plugin_order_config()


@plugins_router.get("")
def get_main():
    return RedirectResponse("/plugins/", 301)


@plugins_router.get("/")
async def return_plugins():
    """Installed plugins for the host UI; includes ``enabled`` from feature_config (do not omit disabled)."""
    local_plugins = manager.get_local_plugins()
    return [
        {
            **p.flatten(),
            "remoteUrl": f"/official-plugins/{p.core.slug}/frontend/dist/remoteEntry.js",
            "enabled": resolve_plugin_enabled_from_config(p.core.slug),
        }
        for p in local_plugins
    ]


@plugins_router.post("/install")
async def post_install_plugin(req: InstallRequest):
    print(f"Installing: {req.plugin.core.slug} from {req.plugin.download_link}")
    try:
        slug = req.plugin.core.slug
        curr_installs = manager.get_install_tasks()
        install_task: Task = curr_installs.get(slug)

        if install_task is not None:
            if not install_task.done():
                raise HTTPException(
                    409, detail="Install already in progress for this plugin"
                )
            try:
                result = install_task.result()
            except plugins.exceptions.InstallError as e:
                raise HTTPException(400, detail=e.message) from e
            except Exception as e:
                raise HTTPException(400, detail=str(e)) from e
            if isinstance(result, InstalledPlugin):
                raise HTTPException(400, detail="Plugin already installed")

        manager.install_and_track(req.plugin, OFFICIAL_PLUGINS_PATH)
        return {"slug": slug, "status": "installing"}

    except plugins.exceptions.InvalidPluginStructureError as e:
        raise HTTPException(400, f"Malformed plugin: {e.message}")
    except plugins.exceptions.InstallError as e:
        raise HTTPException(400, detail=e.message) from e


@plugins_router.get("/status/{slug:path}")
async def get_install_status(slug: str):
    # slug = slug.replace("_", "/")
    task = manager.get_install_tasks().get(slug)
    if not task:
        return {"error": "No install task found"}, 404

    progress = manager.get_install_progress(slug)

    if not task.done():
        return {"status": "installing", "progress": progress}
    if task.cancelled():
        return {"status": "cancelled", "progress": progress}
    exc = task.exception()
    if exc:
        return {"status": "failed", "error": str(exc), "progress": progress}
    result: InstalledPlugin = task.result()
    return {
        "status": "complete",
        "install_path": str(result.install_path),
        "progress": progress,
    }


@plugins_router.post("/uninstall")
async def post_uninstall_plugin(req: ModificationRequest):
    try:
        installed = manager.get_local_plugins()
        for plugin in installed:
            if plugin.core.slug == req.slug:
                print(f"Uninstalling matched plugin: {req.slug}")
                await uninstall_plugin(plugin.to_installed())

                # config = load_feature_config()
                # del config["plugins"][plugin.core.slug]
                # write_feature_config(config)

                manager.clear_install_task(req.slug)
                return

        print(f"Couldn't find {req.slug} to uninstall")
        raise HTTPException(400, f"{req.slug} not installed")
    except ValueError as e:
        raise HTTPException(400, str(e))
    except FileNotFoundError as e:
        raise HTTPException(400, str(e))


@plugins_router.patch("/enable")
async def enable_plugin(req: ModificationRequest):
    try:
        installed = manager.get_local_plugins()
        for plugin in installed:
            if plugin.core.slug == req.slug:
                print("Starting plugin from engine")
                await manager.start_plugin(plugin.to_installed())
                enable_plugin_feature(req.slug)
                return {"slug": req.slug, "status": "enabled", "enabled": True}

        raise HTTPException(404, detail=f"No installed plugin named: {req.slug}")
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(400, detail=str(e)) from e


@plugins_router.patch("/disable")
async def disable_plugin(req: ModificationRequest):
    try:
        local_plugins = manager.get_local_plugins()
        for plugin in local_plugins:
            if plugin.core.slug == req.slug:
                print("Stopping plugin from engine")
                await manager.stop_plugin(req.slug)
                disable_plugin_feature(req.slug)
                return {"slug": req.slug, "status": "disabled", "enabled": False}
        raise HTTPException(404, detail=f"No installed plugin with slug: {req.slug}")
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(400, detail=str(e)) from e


@plugins_router.get("/installed")
async def list_plugins(req: Request):
    try:
        plugins = manager.get_local_plugins()
        return plugins
    except Exception:
        raise HTTPException(500, "Faild finding plugins")


@plugins_router.get("/live")
async def get_live_plugins(req: Request):
    try:
        live = manager.get_live_plugins()
        return live
    except Exception:
        raise HTTPException(500, "Failed gathering live plugins")


@plugins_router.get("/logs")
@wrap_sse_stream
async def stream_plugin_log(req: Request, slug: str = Query(...)):
    if "/" not in slug:
        raise HTTPException(400, detail="Invalid plugin slug")

    try:
        gen = engine.stream_log(slug)

        first_val = await gen.__anext__()

        async def yield_logs():
            yield first_val
            async for item in gen:
                yield item

        return yield_logs()
    except (
        plugins.exceptions.PluginNotFoundError,
        plugins.exceptions.PluginNotRunningError,
    ) as e:

        async def yield_error(e):
            yield {"event": "error", "data": str(e)}

        return yield_error(e)


class Redirect(BaseModel):
    prefix: str
    port: int


class ConfigurationRequest(BaseModel):
    redirects: List[Redirect]


@plugins_router.post("/configuration/redirect")
async def update_configuration(req: ConfigurationRequest):
    for redirect in req.redirects:
        manager.set_redirect(redirect.prefix, redirect.port)
