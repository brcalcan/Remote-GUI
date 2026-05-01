#!/bin/bash
set -euo pipefail

# Set defaults
export VITE_API_URL=${VITE_API_URL:-http://localhost:8080}
export REMOTE_GUI_FE=${REMOTE_GUI_FE:-31800}
export REMOTE_GUI_BE=${REMOTE_GUI_BE:-8080}

# Write runtime config into the built frontend
cat > /app/CLI/local-cli-fe-full/build/config.js <<CONF
window._env_ = {
  VITE_API_URL: "${VITE_API_URL}"
};
CONF

# Start backend
$VIRTUAL_ENV/bin/uvicorn CLI.local-cli-backend.main:app --host 0.0.0.0 --port ${REMOTE_GUI_BE} &

# Serve frontend with SPA fallback (serves index.html for all unknown routes)
python3 - <<PYEOF
import os, sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

BUILD_DIR = "/app/CLI/local-cli-fe-full/build"
PORT = int(os.environ.get("REMOTE_GUI_FE", 31800))

class SPAHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BUILD_DIR, **kwargs)

    def do_GET(self):
        # If file exists, serve it normally; otherwise serve index.html
        path = BUILD_DIR + self.path.split("?")[0]
        if not os.path.exists(path) or os.path.isdir(path) and not os.path.exists(path + "/index.html"):
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, format, *args):
        pass  # suppress per-request logs

print(f"Serving frontend on port {PORT}", flush=True)
HTTPServer(("0.0.0.0", PORT), SPAHandler).serve_forever()
PYEOF
