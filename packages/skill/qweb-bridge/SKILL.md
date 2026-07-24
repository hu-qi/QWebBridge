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
| `navigate` | `url`, `tabId`, `newTab`(bool), `group_title`, `_session` | `{success, url, tabId}` | Always use `newTab:true` on first call. `tabId` selects an existing tab |
| `find_tab` | `url_contains`, `active`(bool), `_tabId` | `{tabId, url, title}` | **Reuse an open tab.** `url_contains` matches domain substring. `active:true` picks the user's current tab |
| `snapshot` | `tabId`, `roles`, `name_contains`, `depth`, `interactive_only` | tree with opaque refs | **Accessibility tree** — use filters on complex SPAs |
| `multi_snapshot` | `tabIds`, plus snapshot filters | `{results:[{tabId, tree}]}` | Batch snapshots for several tabs in one call |
| `click` | `selector` (ref or CSS), `tabId` | `{success, tag, text}` | Synthetic `el.click()`. Omit `tabId` for an opaque ref |
| `mouse_click` | `selector` (ref or CSS), `tabId` | `{success, x, y, tag, text}` | Dispatches JS `MouseEvent` at element center. Omit `tabId` for an opaque ref |
| `fill` | `selector`, `value`, `tabId`, `submit` | `{success, tag, mode, submitted}` | Works on `<input>` / `<textarea>` AND `[contenteditable]`; `submit:true` sends Enter |
| `evaluate` | `code`, `tabId`, `parse_json`, `structured` | JS value or `{value,type}` | Use `structured:true` to distinguish empty/null/undefined; `parse_json:true` parses JSON strings |
| `batch_eval` | `tabIds`, `code`, `parse_json`, `structured` | `{results:[{tabId,value}]}` | Evaluate the same JS across multiple tabs |
| `screenshot` | `tabId`, `format`(png\|jpeg), `quality`(0-100) | `{format, dataLength, data}` (base64) | **Use helper script** (`scripts/screenshot.sh`) to avoid base64 flooding context |
| `network` | `cmd`(start\|stop\|list\|detail), `tabId`, `filter` | request/response data | |
| `key_type` | `text`, `tabId` | `{success}` | Types text one char at a time via Chrome CDP `Input.insertText` |
| `send_keys` | `keys` (e.g. `"Escape"`, `"Control+A"`), `tabId` | `{success}` | Sends keyboard shortcut via CDP `Input.dispatchKeyEvent` |
| `wait_for` | `selector`, `tabId`, `text`, `state`, `timeout` | `{success, found, ref, elapsed_ms}` | Waits for visible/hidden/removed elements |
| `streaming_status` | `selector`, `tabId` | `{isStreaming, hasPendingAuth, url, title}` | Detects ChatGPT-style streaming and pending auth buttons |
| `upload` | `selector`, `tabId`, `files`(string[]) | `{success, fileCount}` | Upload files to a file input |
| `save_as_pdf` | `tabId`, `format`, `landscape`, `scale`, `print_background` | `{data}` (base64 PDF) | |
| `list_tabs` | — | `{tabs: [{tabId, url, title, active}]}` | |
| `close_tab` | `_tabId` | `{success}` | |
| `close_session` | `_session`, `_tabIds` | `{success}` | Call at task end to clean up. `_session` closes all tabs in that group |
| `status` | — | `{running, port, extensions_connected, uptime_seconds}` | Call `/health` endpoint |

### Tab-scoped refs

Refs use an opaque format such as `@qref_v1_<runtime>_<id>`.
Refs may be produced by `snapshot`, `multi_snapshot`, or `wait_for`.
Pass the complete ref back without changing it.
The extension obtains the source tab from the ref.
Do not pass `tabId` when it is not required.
If you pass `tabId`, it must match the ref.
Legacy `@eN` refs require an explicit `tabId`.

```json
{ "tabIds": [1, 2] }
```

Use a ref from tab 1:

```json
{ "selector": "@qref_v1_6d8c4f_ref123" }
```

A new `snapshot` invalidates earlier refs for that tab.
`wait_for` adds a ref without invalidating current snapshot refs.
Navigation, reload, and tab closure invalidate all refs for that tab.
A service worker restart invalidates refs from the earlier runtime.

Ref errors include `invalid_ref`, `stale_ref`, and `unknown_ref`.
They also include `ref_tab_mismatch`, `tab_closed`, and `node_detached`.

### CDP concurrency

QwebBridge serializes complete operations within one tab.
It runs operations for different tabs concurrently.
The extension limits active tab operations to five by default.
This value is a runtime default, not a protocol guarantee.

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

# click by opaque ref from snapshot
curl -s -X POST http://127.0.0.1:10086/api/tool/click \
  -H 'Content-Type: application/json' \
  -d '{"selector":"@qref_v1_6d8c4f_ref123"}'

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

`snapshot` returns opaque refs for accessibility nodes.
Use these refs with `click`, `mouse_click`, and `fill`.
Opaque refs avoid CSS class changes.

Fall back to `evaluate` (JS) only when:

- The target has no ref in the snapshot
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
- Use opaque refs from `snapshot` over CSS selectors when possible.
- Call `close_session` (or `close_tab`) to clean up at task end.
