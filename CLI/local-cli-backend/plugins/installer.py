import asyncio
import os
import shutil
import traceback
import zipfile
from pathlib import Path
from typing import Awaitable, Callable, Optional

import aiofile
import httpx

from feature_config_loader import delete_plugin_feature, write_plugin_feature
from plugins import manager
from plugins.base import (
    InstalledPlugin,
    MarketplacePlugin,
    PluginCore,
    build_complete_plugin,
)
from plugins.exceptions import InstallError, InvalidPluginStructureError
from plugins.template import CRACO_CONFIG

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _format_step_failure(
    step: str,
    plugin_slug: str,
    plugin_path: Path,
    exc: Exception,
    extra: Optional[dict] = None,
) -> str:
    details = [
        f"[plugin-install][error] step={step}",
        f"plugin={plugin_slug}",
        f"install_path={plugin_path}",
        f"error_type={type(exc).__name__}",
        f"error={exc}",
        f"cwd={os.getcwd()}",
        f"path_env={os.environ.get('PATH', '')}",
    ]
    if extra:
        for key, value in extra.items():
            details.append(f"{key}={value}")
    details.append("traceback:")
    details.append(traceback.format_exc())
    return "\n".join(details)


def _log_step_failure(
    step: str,
    plugin_slug: str,
    plugin_path: Path,
    exc: Exception,
    extra: Optional[dict] = None,
):
    message = _format_step_failure(step, plugin_slug, plugin_path, exc, extra)
    print(message)
    try:
        plugin_path.mkdir(parents=True, exist_ok=True)
        with open(plugin_path / "install_error.log", "a", encoding="utf-8") as log_file:
            log_file.write(message + "\n\n")
    except Exception as log_exc:
        print(
            f"[plugin-install][error] Failed writing install_error.log for {plugin_slug}: {log_exc}"
        )


def _require_tool(
    tool_name: str, plugin_slug: str, plugin_path: Path, plugin_core: PluginCore
):
    resolved = shutil.which(tool_name)
    if resolved:
        return resolved
    err = FileNotFoundError(
        f"Required executable '{tool_name}' was not found in PATH inside runtime environment"
    )
    _log_step_failure(
        step="preflight-runtime-tools",
        plugin_slug=plugin_slug,
        plugin_path=plugin_path,
        exc=err,
        extra={"missing_tool": tool_name},
    )
    raise InstallError(
        (
            f"Missing required runtime tool '{tool_name}'. "
            "Install Node.js/npm in the runtime container to enable plugin frontend builds."
        ),
        core=plugin_core,
        install_path=plugin_path,
    )


def write_plugin_craco(slug: str, entryFileName: str, filepath: Path):
    _, plugin_name = slug.split("/")
    with open(filepath / "craco.config.js", "w") as f:
        formatted = CRACO_CONFIG.substitute(
            plugin_name=plugin_name.replace("-", "_"),
            entryFile=entryFileName,
            plugin_mount_fe_url=f"http://localhost:8000/official-plugins/{slug}/frontend/build/",
        )
        f.write(formatted)


async def install_plugin(
    mkt_plugin: MarketplacePlugin,
    plugins_path: Path,
    on_progress: Optional[Callable[[str], Awaitable[None]]],
) -> InstalledPlugin:
    loop = asyncio.get_event_loop()
    slug = mkt_plugin.core.slug

    plugins_basepath = Path(plugins_path)
    plugins_basepath.mkdir(parents=True, exist_ok=True)

    plugin_path = plugins_basepath.joinpath(slug)
    plugin_path.mkdir(parents=True, exist_ok=True)

    if on_progress:
        await on_progress("Downloading plugin contents")

    print(f"Attempting download: {repr(str(mkt_plugin.download_link))}")

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            async with client.stream("GET", str(mkt_plugin.download_link)) as resp:
                resp.raise_for_status()
                async with aiofile.async_open(plugin_path / "file.zip", "wb") as f:
                    async for chunk in resp.aiter_bytes():
                        await f.write(chunk)
    except Exception as e:
        _log_step_failure(
            step="download",
            plugin_slug=slug,
            plugin_path=plugin_path,
            exc=e,
            extra={"download_link": str(mkt_plugin.download_link)},
        )
        raise InstallError(
            "Failed downloading plugin archive",
            core=mkt_plugin.core,
            install_path=plugin_path,
        ) from e

    if on_progress:
        await on_progress("Extracting plugin contents")

    # with zipfile.ZipFile(plugin_path.joinpath("file.zip"), "r") as z:
    #     z.extractall(plugin_path)
    try:

        def extract_zip():
            with zipfile.ZipFile(plugin_path / "file.zip", "r") as z:
                z.extractall(plugin_path)
            os.remove(plugin_path / "file.zip")

        await loop.run_in_executor(None, extract_zip)
    except Exception as e:
        _log_step_failure(
            step="extract",
            plugin_slug=slug,
            plugin_path=plugin_path,
            exc=e,
            extra={"zip_path": str(plugin_path / "file.zip")},
        )
        raise InstallError(
            "Failed extracting plugin archive",
            core=mkt_plugin.core,
            install_path=plugin_path,
        ) from e

    if on_progress:
        await on_progress("Validating plugin structure")
    backend_path, frontend_path = plugin_path / "backend", plugin_path / "frontend"
    if not backend_path.exists():
        err = FileNotFoundError(f"Missing backend directory at '{backend_path}'")
        _log_step_failure(
            step="validate-structure",
            plugin_slug=slug,
            plugin_path=plugin_path,
            exc=err,
            extra={"missing_path": str(backend_path)},
        )
        raise InvalidPluginStructureError(
            mkt_plugin, plugins_basepath, missing=["backend"]
        )

    if not frontend_path.exists():
        err = FileNotFoundError(f"Missing frontend directory at '{frontend_path}'")
        _log_step_failure(
            step="validate-structure",
            plugin_slug=slug,
            plugin_path=plugin_path,
            exc=err,
            extra={"missing_path": str(frontend_path)},
        )
        raise InvalidPluginStructureError(
            mkt_plugin, plugins_basepath, missing=["frontend"]
        )

    _require_tool("npm", slug, plugin_path, mkt_plugin.core)
    _require_tool("npx", slug, plugin_path, mkt_plugin.core)

    # write_plugin_craco(
    #     slug=mkt_plugin.core.slug,
    #     entryFileName=mkt_plugin.core.manifest.fe_exposed_module,
    #     filepath=frontend_path,
    # )

    if on_progress:
        await on_progress("Installing plugin UI dependencies")

    fe_build_log = Path(frontend_path / "build.log")
    try:
        with open(fe_build_log, "w") as f:
            install_fe_proc = await asyncio.create_subprocess_exec(
                "npm",
                "install",
                "--legacy-peer-deps",
                # stdout=asyncio.subprocess.DEVNULL,
                # stderr=asyncio.subprocess.DEVNULL,
                stdout=f,
                stderr=f,
                cwd=frontend_path,
            )
            install_term_code = await install_fe_proc.wait()

            if install_term_code != 0:
                err = RuntimeError(f"npm install exited with code {install_term_code}")
                _log_step_failure(
                    step="frontend-npm-install",
                    plugin_slug=slug,
                    plugin_path=plugin_path,
                    exc=err,
                    extra={
                        "frontend_path": str(frontend_path),
                        "build_log": str(fe_build_log),
                    },
                )
                raise InstallError(
                    "Failed installing plugin UI dependencies",
                    core=mkt_plugin.core,
                    install_path=plugin_path,
                )

            print("Installed plugin frontend dependencies")

            if on_progress:
                await on_progress("Building plugin UI")

            build_fe_proc = await asyncio.create_subprocess_exec(
                # "npm",
                # "run",
                # "build",
                "npx",
                "vite",
                "build",
                stdout=f,
                stderr=f,
                # stdout=asyncio.subprocess.DEVNULL,
                # stderr=asyncio.subprocess.DEVNULL,
                cwd=frontend_path,
            )
            build_term_code = await build_fe_proc.wait()

            if build_term_code != 0:
                err = RuntimeError(f"vite build exited with code {build_term_code}")
                _log_step_failure(
                    step="frontend-build",
                    plugin_slug=slug,
                    plugin_path=plugin_path,
                    exc=err,
                    extra={
                        "frontend_path": str(frontend_path),
                        "build_log": str(fe_build_log),
                    },
                )
                raise InstallError(
                    "Failed building plugin",
                    core=mkt_plugin.core,
                    install_path=plugin_path,
                )

            print("Built plugin frontend")
            if on_progress:
                await on_progress("Build plugin UI components")
    except InstallError:
        raise
    except Exception as e:
        _log_step_failure(
            step="frontend-tooling",
            plugin_slug=slug,
            plugin_path=plugin_path,
            exc=e,
            extra={
                "frontend_path": str(frontend_path),
                "build_log": str(fe_build_log),
            },
        )
        raise InstallError(
            "Failed running frontend tooling (npm/npx)",
            core=mkt_plugin.core,
            install_path=plugin_path,
        ) from e

    if on_progress:
        await on_progress("Finishing up")

    # shutil.rmtree(Path(frontend_path / "node_modules"))
    try:
        await loop.run_in_executor(None, shutil.rmtree, frontend_path / "node_modules")
    except Exception as e:
        _log_step_failure(
            step="cleanup-node-modules",
            plugin_slug=slug,
            plugin_path=plugin_path,
            exc=e,
            extra={"node_modules_path": str(frontend_path / "node_modules")},
        )
        raise InstallError(
            "Failed during plugin cleanup",
            core=mkt_plugin.core,
            install_path=plugin_path,
        ) from e

    installed = InstalledPlugin(core=mkt_plugin.core, install_path=plugin_path)

    try:
        complete_plugin = build_complete_plugin(installed, mkt_plugin)
        complete_plugin.write(plugin_path, "plugin_installation.json")
    except Exception as e:
        _log_step_failure(
            step="write-install-manifest",
            plugin_slug=slug,
            plugin_path=plugin_path,
            exc=e,
            extra={"manifest_path": str(plugin_path / "plugin_installation.json")},
        )
        raise InstallError(
            "Failed writing plugin installation metadata",
            core=mkt_plugin.core,
            install_path=plugin_path,
        ) from e

    try:
        # enable_plugin_feature(plugin.core.slug)
        write_plugin_feature(mkt_plugin.core)
    except Exception as e:
        _log_step_failure(
            step="feature-config-update",
            plugin_slug=slug,
            plugin_path=plugin_path,
            exc=e,
        )
        raise InstallError(
            "Failed updating feature config for plugin",
            core=mkt_plugin.core,
            install_path=plugin_path,
        ) from e

    if on_progress:
        await on_progress("Completed")

    return installed
    # return installed


async def uninstall_plugin(installed: InstalledPlugin):
    if manager.get_plugin_engine().plugin_running(installed.core.slug):
        await manager.get_plugin_engine().stop_plugin(installed.core.slug)
    plugin_path = installed.install_path
    if not plugin_path.exists():
        raise FileNotFoundError(f"Plugin '{installed.core.slug}' not installed")
    shutil.rmtree(plugin_path, ignore_errors=True)

    dev_dir = installed.install_path.parent
    if dev_dir.exists() and len(os.listdir(dev_dir)) == 0:
        shutil.rmtree(dev_dir, ignore_errors=True)

    delete_plugin_feature(installed.core.slug)
