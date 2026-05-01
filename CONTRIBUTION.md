# Contributing to Remote-GUI

Thank you for contributing! This document outlines the rules and guidelines to keep the codebase clean and the Docker build working consistently.

---

## Project Structure

```
CLI/
  local-cli-backend/   # Python/FastAPI backend
  local-cli-fe-full/   # React/Vite frontend
templates/
start.sh               # Container entrypoint
Dockerfile
```

---

## Frontend Rules

### Do not add backend libraries to the frontend
The frontend runs in the browser. Libraries like `mongoose`, `paramiko`, or anything Node.js/server-specific will break the build.

If you are unsure whether a package is browser-safe, check [bundlephobia.com](https://bundlephobia.com) before adding it.

### Do not use `require()` in frontend code
This project uses Vite, not webpack. Vite does not support CommonJS `require()` in frontend source files. Always use ES module syntax:

```js
// ✅ Correct
import something from 'some-package';

// ❌ Wrong
const something = require('some-package');
```

### Do not use `require.context()`
This is a webpack-only API. Use Vite's `import.meta.glob()` instead:

```js
// ✅ Correct (Vite)
const modules = import.meta.glob('./*/**Page.js', { eager: true });

// ❌ Wrong (webpack only)
const ctx = require.context('./', true, /Page\.js$/);
```

### Do not use `process.env.REACT_APP_*`
This project has been migrated from Create React App to Vite. Environment variables use `import.meta.env.VITE_*`:

```js
// ✅ Correct
const API_URL = window._env_?.VITE_API_URL || import.meta.env.VITE_API_URL || "http://localhost:8080";

// ❌ Wrong
const API_URL = process.env.VITE_API_URL;
```

### Keep `package.json` clean
- No duplicate dependencies
- Runtime dependencies go in `dependencies`, not `devDependencies`
- Do not add packages without checking with the maintainer first
- Do not add packages that are already provided by the backend

---

## Backend Rules

### Add all new Python dependencies to `requirements.txt`
If your code requires a new package, add it to `requirements.txt`. Do not rely on it being installed separately.

### Plugin structure
Each plugin lives in `CLI/local-cli-backend/plugins/<pluginname>/`. The frontend counterpart lives in `CLI/local-cli-fe-full/src/plugins/<pluginname>/`.

Plugin page files must follow the naming convention `<Pluginname>Page.js` for the auto-loader to detect them.

### `plugin_order.json` must be valid JSON
Always validate your JSON before committing. Use [jsonlint.com](https://jsonlint.com) or run:
```bash
python3 -m json.tool CLI/local-cli-backend/plugins/plugin_order.json
```

---

## Docker

### Do not modify the Dockerfile without checking with the maintainer
The Dockerfile has been carefully tuned for consistent multi-arch builds (amd64/arm64). Ad-hoc changes are the primary source of build failures.

### Test your changes build correctly before submitting a PR
```bash
docker build -f Dockerfile . -t anylogco/remote-gui:beta
```

### Do not install packages inside a running container and call it done
If a package is needed at runtime, it must be in `requirements.txt` (Python) or `package.json` (Node). Changes made inside a running container are lost on the next build.

---

## Submitting Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Verify `docker build` passes locally
4. Run `grep -r "require(" CLI/local-cli-fe-full/src/` and `grep -r "process.env" CLI/local-cli-fe-full/src/` — both should return nothing
5. Open a pull request with a clear description of what you changed and why

