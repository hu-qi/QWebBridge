# QwebBridge

Browser bridge for AI agents. Let AI agents control your real browser — navigate, click, fill, screenshot, and more.

## Architecture

```
AI Agent → Daemon (Node.js, localhost:10086) → Chrome Extension (CDP) → Browser
```

## Quick Start

```bash
# 1. Install deps and build
pnpm install
pnpm build

# 2. Start the daemon
node packages/daemon/dist/cli.js run

# 3. Load extension in Chrome
#    - Open chrome://extensions
#    - Enable "Developer mode"
#    - Click "Load unpacked"
#    - Select packages/extension/dist

# 4. Connect an AI agent
#    WebSocket: ws://localhost:10086/selector/command
#    HTTP POST: curl -X POST http://localhost:10086/api/tool/navigate -H 'Content-Type: application/json' -d '{"url":"https://example.com"}'
```

## Tools

| Tool | Description |
|------|-------------|
| navigate | Navigate to URL, open new tabs |
| snapshot | Get page accessibility tree |
| screenshot | Capture page screenshot |
| click | Click element by selector or ref |
| fill | Fill form inputs |
| evaluate | Execute JavaScript |
| mouse_click | Real mouse click with coordinates |
| key_type | Type text character by character |
| send_keys | Send keyboard shortcuts |
| upload | Upload files to file inputs |
| network | Monitor network requests |
| find_tab | Find tab by URL |
| list_tabs | List all tabs |
| close_tab | Close a specific tab |
| close_session | Close all tabs in a session |
| save_as_pdf | Save page as PDF |

## Agent Integration

- **WebSocket**: Connect to `ws://localhost:10086/selector/command` (Kimi WebBridge compatible)
- **MCP**: Run `qweb-bridge mcp` for Claude Desktop / Cursor
- **HTTP REST**: `POST /api/tool/<name>`
- **CLI**: `qweb-bridge navigate --url https://example.com`

## AI Agent Skill

QwebBridge ships with an agent skill for AI-assisted development environments:

```bash
bash packages/skill/install.sh
```

This installs the skill to `~/.agents/skills/qweb-bridge/`, making it auto-discoverable by AI agents. The skill provides:

- Full 16-tool reference with params, return values, and call examples
- Session management and tab group conventions
- Screenshot helper script (avoids base64 context flooding)
- Operations guide for install, start, and troubleshooting

## License

MIT
