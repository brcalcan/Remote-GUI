from datetime import datetime
from pathlib import Path
from typing import Any, Dict
from uuid import uuid4

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    model_serializer,
    model_validator,
)
from pydantic.alias_generators import to_camel


class VersionInfo(BaseModel):
    major: int = Field(ge=0)
    minor: int = Field(ge=0)
    patch: int = Field(ge=0)

    @model_serializer
    def serialize_model(self) -> str:
        return str(self)

    @model_validator(mode="before")
    @classmethod
    def parse_version(cls, v):
        if isinstance(v, str):
            major, minor, patch = map(int, v.split("."))
            return {
                "major": major,
                "minor": minor,
                "patch": patch,
            }
        return v

    def __str__(self) -> str:
        return f"{self.major}.{self.minor}.{self.patch}"

    def _tuple(self):
        return (self.major, self.minor, self.patch)

    def __gt__(self, other):
        if not isinstance(other, VersionInfo):
            return NotImplemented
        return self._tuple() > other._tuple()

    def __lt__(self, other):
        if not isinstance(other, VersionInfo):
            return NotImplemented
        return self._tuple() < other._tuple()

    def __eq__(self, other):
        if not isinstance(other, VersionInfo):
            return NotImplemented
        return self._tuple() == other._tuple()


class PluginManifest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    min_py_version: VersionInfo
    fe_exposed_module: str
    api_prefix: str


class PluginCore(BaseModel):
    name: str
    id: str = Field(default=str(uuid4()))
    slug: str
    description: str
    version: VersionInfo
    manifest: PluginManifest


class MarketplacePlugin(BaseModel):
    core: PluginCore
    thumbnail: HttpUrl
    readme_link: HttpUrl
    download_link: HttpUrl
    repository_link: HttpUrl


class InstalledPlugin(BaseModel):
    core: PluginCore
    install_path: Path
    installed_at: datetime = Field(default_factory=datetime.now)

    def write(self, at_path: Path, file_name: str):
        at_path.mkdir(exist_ok=True, parents=True)
        file = Path(at_path) / file_name

        file.write_text(self.model_dump_json())

    @classmethod
    def load(cls, fp: Path):
        if not fp.exists() or not fp.is_file():
            raise FileNotFoundError(f"Path {fp} not found")

        plugin_json_string = fp.read_text()
        return cls.model_validate_json(plugin_json_string)

class CompletePlugin(BaseModel):
    core: PluginCore

    install_path: Path
    installed_at: datetime

    thumbnail: HttpUrl
    readme_link: HttpUrl
    download_link: HttpUrl
    repository_link: HttpUrl

    def write(self, at_path: Path, file_name: str):
        at_path.mkdir(exist_ok=True, parents=True)
        file = Path(at_path) / file_name

        file.write_text(self.model_dump_json())

    @classmethod
    def load(cls, fp: Path):
        if not fp.exists() or not fp.is_file():
            raise FileNotFoundError(f"Path {fp} not found")

        plugin_json_string = fp.read_text()
        return cls.model_validate_json(plugin_json_string)

    def to_installed(self) -> InstalledPlugin:
        return InstalledPlugin(
            core=self.core,
            install_path=self.install_path,
            installed_at=self.installed_at
        )

    def to_mkt(self) -> MarketplacePlugin:
        return MarketplacePlugin(
            core=self.core,
            thumbnail=self.thumbnail,
            readme_link=self.readme_link,
            download_link=self.download_link,
            repository_link=self.repository_link,
        )
    
    def flatten(self) -> Dict[str, Any]:
        return flatten(self.model_dump())

class LivePlugin(BaseModel):
    installed: InstalledPlugin
    api_prefix: str | None
    internal_port: int | None
    proc_id: int | None

def build_complete_plugin(
    installed: InstalledPlugin,
    marketplace: MarketplacePlugin
) -> CompletePlugin:
    core = (installed or marketplace).core

    return CompletePlugin(
        core=core,
        install_path=installed.install_path,
        installed_at=installed.installed_at if installed else None,

        thumbnail=marketplace.thumbnail if marketplace else None,
        readme_link=marketplace.readme_link if marketplace else None,
        download_link=marketplace.download_link if marketplace else None,
        repository_link=marketplace.repository_link if marketplace else None,
    )

def flatten(d: Dict[str, Any]) -> Dict[str, Any]:
    result = {}
    for k, v in d.items():
        if isinstance(v, dict):
            result.update(flatten(v))
        else:
            result[k] = v
    return result