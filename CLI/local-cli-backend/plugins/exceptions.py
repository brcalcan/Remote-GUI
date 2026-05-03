from pathlib import Path
from typing import List, Optional

from plugins.base import InstalledPlugin, MarketplacePlugin, PluginCore


class PluginError(Exception):
    def __init__(self, message):
        super().__init__(message)


class InstallError(PluginError):
    def __init__(self, message: str, core: PluginCore, install_path: Path):
        super().__init__(message)
        self.message = message
        self.core = core
        self.install_path = install_path


class InvalidPluginStructureError(InstallError):
    def __init__(
        self,
        marketplace_plugin: MarketplacePlugin,
        install_path: Path,
        missing: Optional[List[str]] = None,
    ):
        message = "Invalid plugin package structure."
        if missing:
            message += f" Missing required path: {', '.join(missing)}."
        super().__init__(message, marketplace_plugin.core, install_path)
        self.missing = missing if missing else []


class PluginNotFoundError(PluginError):
    def __init__(self, slug: str):
        super().__init__(f"Plugin '{slug}' not found")


class PluginNotRunningError(PluginError):
    def __init__(self, installed: InstalledPlugin, cause: Optional[str] = None):
        self.installed = installed
        base_message = "The plugin is currently not running"
        if cause:
            super().__init__(f"{base_message}. {cause}")
        else:
            super().__init__(base_message)


class PluginAppInitializationError(Exception):
    def __init__(self, message):
        super().__init__(message)
