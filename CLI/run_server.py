#### To debug in PyCharms or an IDE, start this backend server

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "CLI.local-cli-backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,   # keep False for debugging
        log_level="info",
    )