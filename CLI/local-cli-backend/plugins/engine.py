from plugins.base import CompletePlugin
import asyncio
import os
import re
import sys
from enum import StrEnum
from pathlib import Path
from typing import AsyncGenerator, Dict, List, Optional

import aiofiles
from psutil import AccessDenied, NoSuchProcess, Process

from plugins.base import InstalledPlugin
from plugins.exceptions import PluginError, PluginNotFoundError, PluginNotRunningError

PLUGINS_PATH = (
    Path(os.path.dirname(os.path.abspath(__file__))).parent / "official-plugins"
)

class PluginEngine:
    def __init__(self):
        self.processes: Dict[str, asyncio.subprocess.Process] = {}
        self.plugins: Dict[str, InstalledPlugin] = {}
        self.proc_metrics: Dict[str, Dict[int, Process]] = {}

    def find_local_plugins(self, plugins_path: Path) -> List[CompletePlugin]:
        local_plugins: List[CompletePlugin] = []

        # print(f"Searching {plugins_path=}")
        for root, _, files in os.walk(plugins_path):
            if "plugin_installation.json" in files:
                file_path = Path(root) / "plugin_installation.json"
                try:
                    local_plugins.append(CompletePlugin.load(file_path))
                except Exception as e:
                    print(f"Found corrupted plugin install: {file_path}")
                    print(e)
                    continue

        return local_plugins

    def get_local_plugin_by_id(
        self, plugin_id: str, plugins_path: Path
    ) -> Optional[CompletePlugin]:
        local_plugins = self.find_local_plugins(plugins_path)
        for plugin in local_plugins:
            if plugin.core.slug == plugin_id:
                return plugin
        return None

    async def start_plugin(self, installed_plugin: InstalledPlugin, port: int):
        backend_path = installed_plugin.install_path / "backend"
        venv_path = backend_path / ".venv"

        bin_dir = "Scripts" if sys.platform == "win32" else "bin"
        venv_python = venv_path / bin_dir / "python"
        venv_uvicorn = venv_path / bin_dir / "uvicorn"

        log_path = installed_plugin.install_path / "log.txt"
        log_file = None

        try:
            log_file = open(log_path, "ab")
            if not venv_path.exists():
                venv_proc = await asyncio.create_subprocess_exec(
                    "uv",
                    "venv",
                    str(venv_path),
                    "--seed",
                    cwd=backend_path,
                )
                if await venv_proc.wait() != 0:
                    raise Exception("Failed to create environment for plugin")

            setup_proc = await asyncio.create_subprocess_exec(
                "uv",
                "pip",
                "install",
                "-r",
                "requirements.txt",
                "--python",
                str(venv_python),
                cwd=backend_path,
                stdout=log_file,
                stderr=log_file,
            )
            if await setup_proc.wait() != 0:
                raise Exception("Failed to install backend dependencies for plugin")

            proc = await asyncio.create_subprocess_exec(
                str(venv_uvicorn),
                "main:app",
                "--port",
                str(port),
                cwd=backend_path,
                stdout=log_file,
                stderr=log_file,
            )
            self.processes[installed_plugin.core.slug] = proc
            self.plugins[installed_plugin.core.slug] = installed_plugin

            asyncio.create_task(
                self._watch_plugin(installed_plugin.core.slug, proc, log_file)
            )
            return proc

        except Exception as e:
            if log_file:
                log_file.close()
            raise PluginError(f"Unable to start plugin: {e}")

    async def stop_plugin(self, slug: str, timeout: float = 5.0):
        proc = self.processes.get(slug)
        if not proc:
            return

        proc.terminate()
        try:
            await asyncio.wait_for(proc.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()

        self.processes.pop(slug, None)
        self.plugins.pop(slug, None)
        self.proc_metrics.pop(slug, None)

    async def restart_plugin(self, installed_plugin: InstalledPlugin, port: int):
        if installed_plugin.core.slug in self.processes:
            await self.stop_plugin(installed_plugin.core.slug)
        await self.start_plugin(installed_plugin, port)

    def plugin_running(self, slug: str) -> bool:
        proc = self.processes.get(slug)
        if not proc:
            return False
        return proc.returncode is None

    async def _watch_plugin(
        self, slug: str, proc: asyncio.subprocess.Process, log_file
    ):
        try:
            await proc.wait()
        finally:
            log_file.close()
            self.processes.pop(slug, None)
            self.plugins.pop(slug, None)
            self.proc_metrics.pop(slug, None)

    def get_plugin_log_path(self, slug: str) -> Path:
        active_plugin = self.plugins.get(slug)
        if not active_plugin:
            print(f"PLUGINS PATH: {PLUGINS_PATH}")
            installed = self.get_local_plugin_by_id(slug, PLUGINS_PATH)
            if installed is None:
                raise PluginNotFoundError(slug)
            raise PluginNotRunningError(installed.to_installed())
        return Path(active_plugin.install_path) / "log.txt"

    async def stream_log(self, slug: str) -> AsyncGenerator[Dict, None]:
        log_path = self.get_plugin_log_path(slug)

        history = await get_last_n_lines(log_path, 50)
        for line in history:
            yield {"log": parse_log_line(line), "metrics": None}

        async with aiofiles.open(log_path, mode="r") as f:
            await f.seek(0, os.SEEK_END)
            while self.plugin_running(slug):
                line = await f.readline()
                if line:
                    yield {
                        "log": parse_log_line(line),
                        "metrics": self.get_metrics(slug),
                    }
                else:
                    yield {"metrics": self.get_metrics(slug), "log": None}
                    await asyncio.sleep(1)

            yield {"log": "PLUGIN STOPPED", "metrics": None}

    def get_metrics(self, slug: str) -> Optional[Dict[str, float]]:
        if slug not in self.processes:
            return None

        try:
            if slug not in self.proc_metrics:
                self.proc_metrics[slug] = {}

            plugin_cache = self.proc_metrics[slug]
            parent_pid = self.processes[slug].pid

            newly_added = set()

            if parent_pid not in plugin_cache:
                p = Process(parent_pid)
                p.cpu_percent(interval=None)
                plugin_cache[parent_pid] = p
                newly_added.add(parent_pid)

            parent = plugin_cache[parent_pid]

            if not parent.is_running() or parent.status() == "zombie":
                return None

            try:
                current_children = parent.children(recursive=True)
            except (NoSuchProcess, AccessDenied):
                current_children = []

            all_current_pids = {parent.pid} | {c.pid for c in current_children}

            expired = [pid for pid in plugin_cache if pid not in all_current_pids]
            for pid in expired:
                del plugin_cache[pid]

            for child in current_children:
                if child.pid not in plugin_cache:
                    child.cpu_percent(interval=None)
                    plugin_cache[child.pid] = child
                    newly_added.add(child.pid)

            total_cpu = 0.0
            total_mem_mb = 0.0
            total_mem_percent = 0.0
            total_threads = 0

            for pid, p in plugin_cache.items():
                if pid in newly_added:
                    continue
                try:
                    total_cpu += p.cpu_percent(interval=None)
                    mem = p.memory_info()
                    total_mem_mb += mem.rss
                    total_mem_percent += p.memory_percent()
                    total_threads += p.num_threads()
                except (NoSuchProcess, AccessDenied):
                    continue

            return {
                "cpu_percent": round(total_cpu, 2),
                "memory_mb": round(total_mem_mb / (1024 * 1024), 2),
                "memory_percent": round(total_mem_percent, 2),
                "thread_count": total_threads,
            }
        except (NoSuchProcess, AccessDenied):
            return None


_engine: PluginEngine | None = None


def get_plugin_engine() -> PluginEngine:
    global _engine
    if _engine is None:
        _engine = PluginEngine()

    return _engine


async def get_last_n_lines(file_path, n=50):
    lines = []
    chunk_size = 1024  # Read 1KB at a time

    async with aiofiles.open(file_path, mode="rb") as f:
        # Move pointer to the very end of the file
        await f.seek(0, os.SEEK_END)
        file_size = await f.tell()

        pointer = file_size
        buffer = b""

        # Read backwards in chunks
        while len(lines) < n and pointer > 0:
            # Determine how much to read (don't go past start of file)
            step = min(pointer, chunk_size)
            pointer -= step

            await f.seek(pointer)
            chunk = await f.read(step)

            # Combine new chunk with previous remainder
            buffer = chunk + buffer
            lines = buffer.split(b"\n")

        # We might have read one extra partial line if we didn't hit the start
        # Grab the last N lines and decode bytes to string
        result = [line.decode("utf-8", errors="ignore") for line in lines[-n:]]
        return [line for line in result if line]  # Filter out empty lines


class LogLevel(StrEnum):
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"
    DEBUG = "DEBUG"
    RAW = "RAW"


class LogCategory(StrEnum):
    UVICORN = "UVICORN"
    APP = "APP"
    INSTALL = "INSTALL"
    RAW = "RAW"


_UVICORN = re.compile(r"^(INFO|WARNING|ERROR|CRITICAL|DEBUG):\s{5}(.+)$")

_BRACKETED = re.compile(r"^\[([^\]]+)\]\s+(.+)$")

_APP_ERROR = re.compile(r"^[Ee]rror\b", re.IGNORECASE)

_INSTALL = re.compile(r"^(\s*[+\-~]\s+\w|Resolved \d|Installed \d|Audited \d)")


def parse_log_line(raw: str) -> dict:
    line = raw.rstrip()

    m = _UVICORN.match(line)
    if m:
        lvl_str, msg = m.group(1), m.group(2)
        level = {
            "WARNING": LogLevel.WARN,
            "CRITICAL": LogLevel.ERROR,
        }.get(
            lvl_str,
            LogLevel(lvl_str)
            if lvl_str in LogLevel._value2member_map_
            else LogLevel.INFO,
        )
        return {
            "raw": line,
            "level": level,
            "category": LogCategory.UVICORN,
            "message": msg,
            "context": None,
        }

    if _INSTALL.match(line):
        return {
            "raw": line,
            "level": LogLevel.INFO,
            "category": LogCategory.INSTALL,
            "message": line.strip(),
            "context": None,
        }

    m = _BRACKETED.match(line)
    if m:
        ctx, msg = m.group(1), m.group(2)
        level = LogLevel.ERROR if _APP_ERROR.match(msg) else LogLevel.INFO
        return {
            "raw": line,
            "level": level,
            "category": LogCategory.APP,
            "message": msg,
            "context": ctx,
        }

    if _APP_ERROR.match(line):
        level = LogLevel.ERROR
    elif line.startswith("Warning") or line.startswith("WARN"):
        level = LogLevel.WARN
    else:
        level = LogLevel.RAW

    return {
        "raw": line,
        "level": level,
        "category": LogCategory.RAW,
        "message": line,
        "context": None,
    }
