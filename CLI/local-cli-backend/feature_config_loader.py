"""
Feature Configuration Loader
Loads and validates feature configuration from feature_config.json
"""

import json
import os
from pathlib import Path
from typing import Dict, Optional, Set

from plugins.base import PluginCore

# Cache for feature config
_feature_config_cache: Optional[Dict] = None


def get_feature_config_path() -> str:
    """Get the path to feature_config.json"""
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(BASE_DIR, "feature_config.json")


def load_feature_config() -> Dict:
    """
    Load feature configuration from feature_config.json
    Returns cached config if already loaded, otherwise loads from file
    """
    global _feature_config_cache

    if _feature_config_cache is not None:
        return _feature_config_cache

    config_path = get_feature_config_path()

    if not os.path.exists(config_path):
        print(f"⚠️  Warning: feature_config.json not found at {config_path}")
        print("⚠️  Using default: all features enabled")
        # Return default config with all features enabled
        _feature_config_cache = {"features": {}, "plugins": {}, "version": "1.0.0"}
        return _feature_config_cache

    try:
        with open(config_path, "r") as f:
            config = json.load(f)
            _feature_config_cache = config
            return config
    except Exception as e:
        print(f"❌ Error loading feature_config.json: {e}")
        print("⚠️  Using default: all features enabled")
        _feature_config_cache = {"features": {}, "plugins": {}, "version": "1.0.0"}
        return _feature_config_cache


def is_feature_enabled(feature_name: str) -> bool:
    """
    Check if a core feature is enabled.
    Config is source of truth:
    - missing feature => disabled
    """
    config = load_feature_config()
    features = config.get("features", {})

    feature = features.get(feature_name)

    if feature is None:
        return False

    return feature.get("enabled", True)


def is_plugin_enabled(plugin_name: str) -> bool:
    """
    Check if a plugin is enabled.
    Config is source of truth:
    - missing plugin => disabled
    """
    config = load_feature_config()
    plugins = config.get("plugins", {})

    plugin = plugins.get(plugin_name)

    if plugin is None:
        return False

    return plugin.get("enabled", True)


def get_enabled_features() -> Set[str]:
    """Get set of all enabled feature names"""
    config = load_feature_config()
    features = config.get("features", {})
    return {name for name, data in features.items() if data.get("enabled", True)}


def get_enabled_plugins() -> Set[str]:
    """Get set of all enabled plugin names"""
    config = load_feature_config()
    plugins = config.get("plugins", {})
    return {name for name, data in plugins.items() if data.get("enabled", True)}


def get_backend_router_for_feature(feature_name: str) -> Optional[str]:
    """Get the backend router name for a feature, if specified"""
    config = load_feature_config()
    features = config.get("features", {})
    if feature_name in features:
        return features[feature_name].get("backend_router")
    return None


def reload_config():
    """Force reload of feature config (useful for testing or hot-reload)"""
    global _feature_config_cache
    _feature_config_cache = None
    return load_feature_config()


def read_feature_config() -> dict:
    path = Path(get_feature_config_path())
    if not path.exists():
        return {"version": "1.0.0", "features": {}, "plugins": {}}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {"version": "1.0.0", "features": {}, "plugins": {}}


def write_feature_config(config: dict) -> None:
    path = Path(get_feature_config_path())
    path.write_text(json.dumps(config, indent=2))
    reload_config()


def write_plugin_feature(core: PluginCore) -> None:
    config = load_feature_config()

    config["plugins"][core.slug] = {
        "name": core.name,
        "enabled": True,
        "description": core.description,
    }
    write_feature_config(config)


def delete_plugin_feature(slug: str) -> None:
    config = load_feature_config()

    del config["plugins"][slug]
    write_feature_config(config)


def _find_plugin_config_key(plugins: dict, install_slug: str) -> Optional[str]:
    if install_slug in plugins:
        return install_slug
    for k, v in plugins.items():
        if isinstance(v, dict) and v.get("slug") == install_slug:
            return k
    return None


def resolve_plugin_enabled_from_config(install_slug: str) -> bool:
    config = load_feature_config()
    plugins = config.get("plugins", {})
    key = _find_plugin_config_key(plugins, install_slug)
    if key is None:
        return True
    return bool(plugins[key].get("enabled", True))


def set_plugin_enabled_by_install_slug(install_slug: str, enabled: bool) -> None:
    config = read_feature_config()
    plugins = config.setdefault("plugins", {})
    key = _find_plugin_config_key(plugins, install_slug)
    if key is None:
        plugins.setdefault(install_slug, {})
        plugins[install_slug]["enabled"] = enabled
    else:
        plugins[key]["enabled"] = enabled
    write_feature_config(config)


def enable_plugin_feature(slug: str) -> None:
    set_plugin_enabled_by_install_slug(slug, True)


def disable_plugin_feature(slug: str) -> None:
    set_plugin_enabled_by_install_slug(slug, False)
