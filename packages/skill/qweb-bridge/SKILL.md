---
name: qweb-bridge
description: Use when controlling the user's real browser — navigate, click, type, fill forms, screenshot, read page content, monitor network requests, upload files, save PDFs, or manage browser tabs. Also use when the user mentions "browser", "webpage", "open URL", "screenshot", or asks AI to interact with any website using their browser login sessions.
---

# QwebBridge

Browser bridge for AI agents. Controls Chrome via a local daemon at `http://127.0.0.1:10086` + Chrome extension.

## CLI

```bash
qweb-bridge status          # Show daemon status (JSON)
qweb-bridge start           # Start daemon (background)
qweb-bridge stop            # Stop daemon
qweb-bridge restart         # Restart daemon
qweb-bridge logs -n 100     # Show recent logs
qweb-bridge logs -f         # Follow logs live
qweb-bridge logs --prev     # View previous run's logs
qweb-bridge install-skill   # Install skill to AI agent runtimes
qweb-bridge uninstall       # Stop daemon + remove all data
qweb-bridge run             # Start daemon (foreground)
qweb-bridge mcp             # MCP mode (Claude Desktop/Cursor)
```

## Health check (always do this first)

```bash
qweb-bridge status
# or
curl -s http://127.0.0.1:10086/health
```

Then act on the result:

- **`{"running": true, "extensions_connected": true}`** — healthy. Proceed with the tool calls below.
- **Connection refused** or `running: false` — daemon not running.
- **`extensions_connected: false`** — extension not connected. Read `references/operations.md`.

## Tools

All tools are called via HTTP POST. Format:

```
POST http://127.0.0.1:10086/api/tool/<name>
Content-Type: application/json

{ "param1": "value1", ... }
```

Response: `{ "success": true, "result": { ... } }`

| Tool | Params | Returns | Note |
|------|--------|---------|------|
| `navigate` | `url`, `newTab`(bool), `group_title`, `_session` | `{success, url, tabId}` | Always use `newTab:true` on first call. `_session` controls tab group color isolation |
| `find_tab` | `url_contains`, `active`(bool), `_tabId` | `{tabId, url, title}` | **Reuse an open tab.** `url_contains` matches domain substring. `active:true` picks the user's current tab |
| `snapshot` | — | `{url, title, tree}` with `@e` refs | **Accessibility tree** — use this to read page content and locate elements |
| `click` | `selector` (@e ref or CSS) | `{success, tag, text}` | Synthetic `el.click()`. Use `@eN` refs from snapshot when possible |
| `mouse_click` | `selector` (@e ref or CSS) | `{success, x, y, tag, text}` | Dispatches JS `MouseEvent` at element center. Works on `<a>` links. |
| `fill` | `selector`, `value` | `{success, tag, mode}` | Works on `<input>` / `<textarea>` AND `[contenteditable]` |
| `evaluate` | `code` (supports async/await) | JS serialized value | Use compact `JSON.stringify` output. Wrap `const`/`let` in IIFE for fresh scope |
| `screenshot` | `format`(png\|jpeg), `quality`(0-100) | `{format, dataLength, data}` (base64) | **Use helper script** (`scripts/screenshot.sh`) to avoid base64 flooding context |
| `network` | `cmd`(start\|stop\|list\|detail), `filter` | request/response data | |
| `key_type` | `text` | `{success}` | Types text one char at a time via Chrome CDP `Input.insertText` |
| `send_keys` | `keys` (e.g. `"Escape"`, `"Control+A"`) | `{success}` | Sends keyboard shortcut via CDP `Input.dispatchKeyEvent` |
| `upload` | `selector`, `files`(string[]) | `{success, fileCount}` | Upload files to a file input |
| `save_as_pdf` | `format`, `landscape`, `scale`, `print_background` | `{data}` (base64 PDF) | |
| `list_tabs` | — | `{tabs: [{tabId, url, title, active}]}` | |
| `close_tab` | `_tabId` | `{success}` | |
| `close_session` | `_session`, `_tabIds` | `{success}` | Call at task end to clean up. `_session` closes all tabs in that group |
| `status` | — | `{running, port, extensions_connected, uptime_seconds}` | Call `/health` endpoint |

### Using find_tab

Use `find_tab` when the user asks to operate on an already-open tab:

```bash
# Find leftmost matching tab
curl -s http://127.0.0.1:10086/api/tool/find_tab \
  -H 'Content-Type: application/json' \
  -d '{"url_contains":"example.com"}'

# Find user's active tab (use when user says "在我当前的页面上")
curl -s http://127.0.0.1:10086/api/tool/find_tab \
  -H 'Content-Type: application/json' \
  -d '{"url_contains":"example.com","active":true}'
```

If it returns an error ("no tab found"), the page is not open — fall back to `navigate` with `newTab:true`.

### Sessions

Each `_session` maps to a distinct colored tab group in Chrome. Use different session names to keep tasks isolated:

```bash
curl -s -X POST http://127.0.0.1:10086/api/tool/navigate \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","newTab":true,"_session":"my-task"}'
```

Without `_session`, tabs are grouped under "agent".

### Call examples

```bash
# status
qweb-bridge status

# navigate
curl -s -X POST http://127.0.0.1:10086/api/tool/navigate
  -H 'Content-Type: application/json'
  -d '{"url":"https://example.com","newTab":true}'

# click by CSS selector
curl -s -X POST http://127.0.0.1:10086/api/tool/click \
  -H 'Content-Type: application/json' \
  -d '{"selector":".submit-btn"}'

# click by @e ref from snapshot
curl -s -X POST http://127.0.0.1:10086/api/tool/click \
  -H 'Content-Type: application/json' \
  -d '{"selector":"@e3"}'

# fill a textarea
curl -s -X POST http://127.0.0.1:10086/api/tool/fill \
  -H 'Content-Type: application/json' \
  -d '{"selector":"#bio","value":"Hello World"}'

# execute JavaScript
curl -s -X POST http://127.0.0.1:10086/api/tool/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"code":"JSON.stringify({title: document.title, url: location.href})"}'
```

## Screenshots: Use the Helper Script

Never call the screenshot API directly — it returns base64-encoded image data that floods the context window.

Use `scripts/screenshot.sh` instead:

```bash
# Default — saves to /tmp/qweb-bridge-screenshots/{timestamp}.png
bash "$(dirname "$SKILL_PATH")/scripts/screenshot.sh"

# Custom output path
bash "$(dirname "$SKILL_PATH")/scripts/screenshot.sh" -o /tmp/page.png

# JPEG format, quality 60
bash "$(dirname "$SKILL_PATH")/scripts/screenshot.sh" -f jpeg -q 60
```

After getting the file path, use the Read tool to view the image.

If `$SKILL_PATH` is unavailable, call the script by its absolute path.

## Prefer snapshot over manual selectors

`snapshot` returns the page accessibility tree with `@e` refs based on semantic role/name. Use these refs with `click`, `mouse_click`, and `fill` — they survive CSS class hash changes that break manually-written CSS selectors.

Fall back to `evaluate` (JS) only when:
- The target has no `@e` ref in the snapshot
- You need attributes not in the snapshot (e.g., `href`)
- You need to dispatch complex event sequences

## Evaluate Tips

- Use compact `JSON.stringify(data)` — never add formatting. Large responses cause truncation.
- Wrap `const`/`let` declarations in an IIFE: `(() => { const x = ...; return x; })()`
- Use `JSON.stringify()` instead of `toString()` for complex return values

## Text input — use `fill`

`fill` handles all three text input shapes:

| Target | Behavior | Returned `mode` |
|--------|----------|------|
| `<input>` / `<textarea>` | Sets `.value` via native setter, fires `input`/`change` | `"value"` |
| `[contenteditable]` (ProseMirror / TipTap / Lexical / Slate / Quill etc.) | Focuses, clears, calls `document.execCommand('insertText', ...)` | `"contenteditable"` |
| Other element | Best-effort `.value` + events | `"value"` |

`fill` is **clear-and-insert**: existing content is replaced. For append, read current value via `evaluate`, concatenate, then `fill`.

## Form submit / special keys

There's no separate "press Enter" tool. To submit a form, `click` the submit button. To dispatch a key event programmatically:

```bash
{"code":"document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))"}
```

## Save the current page as PDF

```bash
curl -s -X POST http://127.0.0.1:10086/api/tool/save_as_pdf \
  -H 'Content-Type: application/json' \
  -d '{"format":"a4","landscape":false,"print_background":true}'
```

## Event dispatcher (`send_keys`)

Use `send_keys` for keyboard shortcuts that require proper modifier dispatch:

```bash
curl -s -X POST http://127.0.0.1:10086/api/tool/send_keys \
  -H 'Content-Type: application/json' \
  -d '{"keys":"Escape"}'
```

## Agent Integration

| Interface | How to connect |
|-----------|---------------|
| WebSocket | `ws://localhost:10086/selector/command` |
| HTTP REST | `POST /api/tool/<name>` |
| MCP | `qweb-bridge mcp` (stdio JSON-RPC) |
| CLI | `qweb-bridge <tool> <params>` |

## Known limitations

- **`event.isTrusted` sites** (banking, captcha) reject synthetic events. This is a product boundary — no automation primitive without OS focus can produce trusted events.
- **Cross-origin iframes**: tools operate on the top frame. Navigate to the iframe's URL directly instead.

## Code of conduct

- Always do `curl -s http://127.0.0.1:10086/health` first to verify daemon + extension are up.
- Use `scripts/screenshot.sh` for screenshots — never call the API directly.
- Use `@e` refs from `snapshot` over CSS selectors when possible.
- Call `close_session` (or `close_tab`) to clean up at task end.
