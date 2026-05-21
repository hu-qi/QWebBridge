# Operations: install, lifecycle, diagnose

Read this file when the health check in SKILL.md indicates the daemon is unreachable or the extension isn't connected — or when the user explicitly asks to install, start, stop, restart, or troubleshoot QwebBridge.

## Path convention

QwebBridge is a Node.js project cloned from `https://github.com/anomalyco/QwebBridge`. The daemon runs from the project root via `node packages/daemon/dist/cli.js run`.

## Routing table

Run: `curl -s http://127.0.0.1:10086/health`

| Observed | Action |
|---|---|
| `curl: (7) Connection refused` or no response | Daemon not running. Start it. |
| `{"extensions_connected": false, ...}` | Extension not connected. Tell user: "Please open Chrome and go to `chrome://extensions`, enable Developer mode, ensure the QwebBridge extension (Unpacked extension from `packages/extension/dist`) is enabled. If the extension is loaded, toggle it off and on, or check the Service Worker status." |
| `{"extensions_connected": true, ...}` | Healthy. Return to SKILL.md to make tool calls. |

## Install

```bash
git clone https://github.com/anomalyco/QwebBridge.git
cd QwebBridge
pnpm install
pnpm build
```

## Start

```bash
node packages/daemon/dist/cli.js run
```

Load the Chrome extension at `chrome://extensions` → Developer mode → "Load unpacked" → select `packages/extension/dist`.

## Stop

Press `Ctrl+C` in the terminal running the daemon.

## Daily operations

- **Check status:** `curl -s http://127.0.0.1:10086/health`
- **View daemon logs:** stdout from the running node process. Redirect to file on start: `node packages/daemon/dist/cli.js run > ~/.qweb-bridge/daemon.log 2>&1 &`

## Diagnosing common failures

| Symptom | Action |
|---|---|
| `Connection refused` | Daemon not started. Run `node packages/daemon/dist/cli.js run`. |
| `extensions_connected: false` | Chrome extension not loaded. Ask user to check `chrome://extensions` → enable developer mode → ensure QwebBridge extension is enabled. |
| Tool calls time out | Check daemon logs for CDP errors. The extension may have lost connection to the tab — re-navigate. |
| Service worker inactive | Chrome may have stopped the extension's service worker. Ask user to toggle the extension off/on at `chrome://extensions`. |
| Extension loaded but WS never connects | Service worker may need `chrome://extensions` page to be open to stay alive. If it's a fresh install, click the extension icon to trigger the popup (activates the service worker). |
