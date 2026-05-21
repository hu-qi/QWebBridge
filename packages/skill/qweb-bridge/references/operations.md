# Operations: install, lifecycle, diagnose

Read this file when the health check in SKILL.md indicates the daemon is unreachable or the extension isn't connected — or when the user explicitly asks to install, start, stop, restart, or troubleshoot QwebBridge.

## Path convention

QwebBridge runs from `~/.qweb-bridge/repo/` (installed) or a cloned repo. The working directory `~/.qweb-bridge/` contains:

```
~/.qweb-bridge/
├── repo/            # Clone of github.com/hu-qi/QWebBridge
├── bin/             # Symlinks
├── identity.json    # {"device_id":"..."}
├── daemon.pid       # PID of running daemon
└── logs/
    ├── daemon.log       # Current log
    └── daemon.log.prev  # Previous run's logs
```

## Routing table

Run: `qweb-bridge status` or `curl -s http://127.0.0.1:10086/health`

| Observed | Action |
|---|---|
| `curl: (7) Connection refused` or `running: false` | Daemon not running. `qweb-bridge start` or `qweb-bridge run`. |
| `extensions_connected: false` | Extension not connected. Tell user: "Please open Chrome and go to `chrome://extensions`, enable Developer mode, ensure the QwebBridge extension is enabled. If loaded, toggle it off and on." |
| `extensions_connected: true` | Healthy. Return to SKILL.md to make tool calls. |

## Install

```bash
curl -fsSL https://github.com/hu-qi/QWebBridge/raw/main/install.sh | bash
```

Or manually:

```bash
git clone https://github.com/hu-qi/QWebBridge.git
cd QWebBridge
pnpm install
pnpm build
```

## Start

```bash
qweb-bridge start      # Background daemon (recommended)
# or
qweb-bridge run        # Foreground
```

Load the Chrome extension at `chrome://extensions` → Developer mode → "Load unpacked" → select `packages/extension/dist`.

## Stop

```bash
qweb-bridge stop
# or
qweb-bridge shutdown   # via HTTP
```

## Daily operations

- **Check status:** `qweb-bridge status` or `curl -s http://127.0.0.1:10086/health`
- **View logs:** `qweb-bridge logs -n 100`
- **Follow logs:** `qweb-bridge logs -f`
- **Previous run:** `qweb-bridge logs --prev`
- **Restart:** `qweb-bridge restart`
- **Install skill:** `qweb-bridge install-skill` (or `bash packages/skill/install.sh`)
- **Uninstall:** `qweb-bridge uninstall`

## Diagnosing common failures

| Symptom | Action |
|---|---|
| `Connection refused` | Daemon not started. Run `qweb-bridge start` or `qweb-bridge run`. |
| `extensions_connected: false` | Chrome extension not loaded. Ask user to check `chrome://extensions` → enable developer mode → ensure QwebBridge extension is enabled. |
| Tool calls time out | Check `qweb-bridge logs -n 50` for CDP errors. The extension may have lost connection — re-navigate. |
| Service worker inactive | Chrome may have stopped the extension's service worker. Ask user to toggle the extension off/on at `chrome://extensions`. |
| Extension loaded but WS never connects | Service worker may need the `chrome://extensions` page to stay alive. Click the extension icon to activate it. |
