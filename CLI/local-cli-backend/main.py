import configparser
import os
import sys
from pathlib import Path
from typing import Dict

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# --- Paths ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
PLUGIN_BUILDS_DIR = Path(__file__).resolve().parent / "official-plugins"

sys.path.append(BASE_DIR)

# Setup.cfg for version endpoint
SETUP_CFG_FILE = os.path.join(__file__.split("CLI")[0], "setup.cfg")

# --- Imports ---
import helpers
from classes import *

from sql_router import sql_router
from file_auth_router import file_auth_router
from security.security_router import security_router

from file_auth import file_bookmark_node, file_set_default_bookmark

from feature_config_loader import (
    get_enabled_features,
    get_enabled_plugins,
    is_feature_enabled,
    load_feature_config,
)

from helpers import (
    grab_network_nodes,
    make_policy,
    make_request,
    monitor_network,
    send_json_data,
)

from parsers import parse_response

from plugins.loader import load_plugins
from plugins.manager import get_plugin_manager
from plugins_router import plugins_router

# --- App init ---
app = FastAPI()

FRONTEND_URL = os.getenv("FRONTEND_URL", "*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# --- Feature config ---
feature_config = load_feature_config()
print("📋 Feature Configuration Loaded:")
print(f"   Enabled features: {get_enabled_features()}")
print(f"   Enabled plugins: {get_enabled_plugins()}")

# --- Middleware ---
@app.middleware("http")
async def feature_check_middleware(request: Request, call_next):
    path = request.url.path

    # unified skip list (merged both sides)
    if (
        path.startswith("/static/")
        or path.startswith("/docs")
        or path.startswith("/openapi.json")
        or path == "/"
        or path == "/feature-config"
        or path == "/version"
    ):
        return await call_next(request)

    feature_path_map = {
        "/sql": "sqlquery",
        "/auth": "bookmarks",
        "/security": "security",
    }

    for prefix, feature_name in feature_path_map.items():
        if path.startswith(prefix):
            if prefix == "/auth":
                if "bookmark" in path:
                    if not is_feature_enabled("bookmarks"):
                        return Response('{"detail":"bookmarks disabled"}', 403)
                elif "preset" in path:
                    if not is_feature_enabled("presets"):
                        return Response('{"detail":"presets disabled"}', 403)
                elif not (
                    is_feature_enabled("bookmarks")
                    or is_feature_enabled("presets")
                ):
                    return Response('{"detail":"feature disabled"}', 403)
            else:
                if not is_feature_enabled(feature_name):
                    return Response(f'{{"detail":"{feature_name} disabled"}}', 403)
            break

    return await call_next(request)

# --- Routers ---
if is_feature_enabled("sqlquery"):
    app.include_router(sql_router)

if is_feature_enabled("bookmarks") or is_feature_enabled("presets"):
    app.include_router(file_auth_router)

if is_feature_enabled("security"):
    app.include_router(security_router)

# --- Plugins ---
load_plugins(app)

# --- REST bootstrap (from upstream) ---
REST_CONN = os.getenv("REST_CONN")
if REST_CONN:
    REST_CONN = REST_CONN.strip()
    file_bookmark_node(REST_CONN)
    file_set_default_bookmark(REST_CONN)

# --- Version endpoint (from upstream) ---
def _get_remote_gui_version() -> str:
    try:
        if os.path.exists(SETUP_CFG_FILE):
            config = configparser.ConfigParser()
            config.read(SETUP_CFG_FILE)
            return config.get("metadata", "version", fallback="—")
    except Exception:
        pass
    return "—"


@app.get("/version")
def get_version():
    v = _get_remote_gui_version()
    return {"version": v, "remote_gui_version": v}


# --- Helpers ---
def should_force_raw_text(command_text: str) -> bool:
    return "get msg client" in command_text.lower()


# --- Core endpoint example (merged cleanly) ---
@app.post("/send-command/")
def send_command(conn: Connection, command: Command):
    if not is_feature_enabled("client"):
        raise HTTPException(403, "client disabled")

    try:
        cmd = command.cmd.strip()
        raw = make_request(conn.conn, command.type, cmd)

        if isinstance(raw, dict) and raw.get("type") == "error":
            return raw

        if command.raw_text or should_force_raw_text(cmd):
            return {"type": "raw", "data": str(raw)}

        return parse_response(raw)

    except Exception as e:
        return {"type": "error", "data": str(e)}


# --- Feature config endpoint ---
@app.get("/feature-config")
def get_feature_config_endpoint():
    config = load_feature_config()
    return config


app.include_router(plugins_router)

# --- Static listing ---
@app.get("/")
def list_static_files():
    files = []
    for root, _, filenames in os.walk(STATIC_DIR):
        for f in filenames:
            files.append(f)
    return {"files": files}


# --- Plugin manager ---
app.mount(
    "/official-plugins",
    StaticFiles(directory=str(PLUGIN_BUILDS_DIR), html=True),
    "official-plugins",
)

manager = get_plugin_manager()
manager.set_app(app)