# QwebBridge Design Spec

> **Date**: 2026-05-20  
> **Status**: Draft  
> **Goal**: 完全复刻 Kimi WebBridge，TypeScript 全栈实现，协议兼容  

## 1. Overview

QwebBridge is a browser bridge for AI agents. It pairs a local Node.js daemon with a Chrome Extension (MV3) to let AI agents control the user's real browser — navigate, click, type, screenshot, read pages — using the user's actual login sessions.

```
AI Agent → Daemon (Node.js, localhost:10086, WebSocket) → Chrome Extension (CDP) → Browser
```

## 2. Architecture

### 2.1 Monorepo Structure

```
QwebBridge/
├── packages/
│   ├── protocol/          # Shared TypeScript protocol types
│   ├── daemon/            # Node.js local service
│   └── extension/         # Chrome Extension MV3
├── docs/
│   └── superpowers/
│       └── specs/         # Design docs
├── package.json           # Workspace root
├── tsconfig.base.json
└── README.md
```

### 2.2 Communication Layers

| Layer | Protocol | Description |
|-------|----------|-------------|
| Agent ↔ Daemon | WebSocket JSON | AI agent sends tool calls to daemon on `localhost:10086` |
| Extension ↔ Daemon | WebSocket JSON | Extension connects as client to same daemon on `localhost:10086` |
| Daemon ↔ Extension | WebSocket JSON (routed) | Daemon relays tool calls through existing Extension connection |
| Extension ↔ Browser | Chrome CDP | Extension controls browser via `chrome.debugger` |

### 2.3 Component Diagram

```
┌──────────────────────────────────────────────────────────┐
│  AI Agent (Claude Code / Kimi Code / Cursor / ...)       │
│  → Initiates tool call (HTTP / CLI / MCP)                │
└──────────────────────┬───────────────────────────────────┘
                       │ WebSocket JSON
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Daemon (Node.js)              localhost:10086            │
│  ┌───────────┐ ┌────────────┐ ┌──────────────────┐       │
│  │ WebSocket │ │ Tool Router│ │ Session Manager  │       │
│  │ Server    │→│ (16 tools) │→│ (tab/session map)│       │
│  └───────────┘ └────────────┘ └──────────────────┘       │
│                              │                            │
│  ┌──────────────────────────┐│  ┌──────────────────┐     │
│  │ Multi-Agent Adapter      ││  │ Install / Config │     │
│  │ (MCP / HTTP / CLI)       ││  │ Manager          │     │
│  └──────────────────────────┘│  └──────────────────┘     │
└──────────────────┬──────────┘                            │
                   │ Extension connects via                  │
                   │ WebSocket to daemon                    │
                   ▼ (localhost:10086)                      │
┌──────────────────────────────────────────────────────────┐
│  Chrome Extension (MV3)                                   │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐   │
│  │ WS Client   │ │ Tool Executor│ │ CDP Controller   │   │
│  │ (daemon)    │→│ (16 tools)   │→│ (chrome.debugger)│  │
│  └─────────────┘ └──────────────┘ └──────────────────┘   │
│                       │                                   │
│  ┌──────────────────┐ │  ┌────────────────────────────┐  │
│  │ Tab Manager      │ │  │ Snapshot / Network Cache   │  │
│  │ (session/group)  │ │  │ (element refs, requests)   │  │
│  └──────────────────┘ │  └────────────────────────────┘  │
└──────────────────────┬─┘                                 │
                       │ CDP (chrome.debugger)              │
                       ▼                                    │
              ┌─────────────────┐                          │
              │  Chrome Browser │                          │
              └─────────────────┘                          │
```

## 3. Protocol Layer (`packages/protocol`)

### 3.1 Directory Structure

```
packages/protocol/
├── src/
│   ├── types.ts          # Message, CommandRequest, CommandResponse etc.
│   ├── tools.ts          # 16 tool param/result type definitions
│   ├── constants.ts      # Error codes, tool name constants
│   └── index.ts
├── package.json
└── tsconfig.json
```

### 3.2 Message Types

WebSocket path: `selector/command`  
Encoding: JSON (wsjson)

```typescript
// Top-level message wrapper
interface Message {
  id: string;
  type: "hello" | "command" | "response" | "error" | "event";
  payload: HelloPayload | CommandRequest | CommandResponse | ErrorDetail;
}

// Agent handshake on connect
interface HelloPayload {
  agent?: string;         // e.g. "claude-code", "kimi-code", "cursor"
  version?: string;
  capabilities?: string[];
}

// Agent initiates tool call
interface CommandRequest {
  tool: string;
  params: Record<string, unknown>;
  session?: string;       // browser session identifier (optional)
}

// Response to agent
interface CommandResponse {
  result: unknown;
}

// Error response
interface ErrorDetail {
  code: string;           // "tool_not_found" | "tab_not_found" | ...
  message: string;
  details?: string;
}
```

### 3.3 Tool Definitions (16 tools)

| # | Tool | Key Params | Result |
|---|------|-----------|--------|
| 1 | `navigate` | `url`, `newTab?`, `_session?`, `group_title?` | `{success, url, tabId}` |
| 2 | `snapshot` | — | A11y tree with `@eN` element refs |
| 3 | `screenshot` | `format?`, `fullPage?`, `selector?`, `element?` | Base64 image or file path |
| 4 | `click` | `selector` (CSS or `@eN` ref) | `{success, tag, text}` |
| 5 | `fill` | `selector`, `value` | `{success, tag, mode}` |
| 6 | `evaluate` | `code` | Script return value |
| 7 | `mouse_click` | `selector` (CSS or `@eN` ref) | `{success, x, y, tag}` |
| 8 | `key_type` | `text` | `{success}` |
| 9 | `send_keys` | `keys` (e.g. "Enter", "Control+A") | `{success}` |
| 10 | `upload` | `selector`, `filePath?`, `files?` | `{success}` |
| 11 | `network` | `cmd` (start/stop/list/detail), `filter?`, `requestId?` | Network request list |
| 12 | `find_tab` | `url`, `_session?` | `{tabId, url, title}` |
| 13 | `list_tabs` | `_tabIds?`, `_session?` | Array of tabs |
| 14 | `close_tab` | `_tabId` | `{success}` |
| 15 | `close_session` | `_tabIds`, `_session?` | `{success}` |
| 16 | `save_as_pdf` | `filePath?` | `{success, filePath?}` |

## 4. Daemon (`packages/daemon`)

### 4.1 Directory Structure

```
packages/daemon/
├── src/
│   ├── server.ts          # WebSocket server entry (listen :10086)
│   ├── router.ts          # Tool routing dispatch
│   ├── session.ts         # Session management (agent connections / tab mapping)
│   ├── protocol/          # Message serialization (reuses @qweb/protocol)
│   │   ├── encoder.ts     # Message → JSON
│   │   └── decoder.ts     # JSON → Message
│   ├── adapters/          # Multi-agent integration adapters
│   │   ├── index.ts       # Adapter registry & startup selection
│   │   ├── websocket.ts   # Native WebSocket (Kimi compatible)
│   │   ├── mcp.ts         # MCP server (stdio/SSE)
│   │   ├── http.ts        # HTTP REST API
│   │   └── cli.ts         # CLI commands
│   ├── install.ts         # One-click install script
│   ├── config.ts          # Config management (port, identity, etc.)
│   └── index.ts
├── bin/
│   └── qweb-bridge        # CLI entry (qweb-bridge run / install / shutdown)
├── package.json
└── tsconfig.json
```

### 4.2 Core Components

**WebSocket Server (`server.ts`)**
- Listens on `localhost:10086`
- Path: `selector/command`
- Protocol: wsjson (JSON-encoded WebSocket frames)
- Connection lifecycle: Hello → Command → Response → Error
- Heartbeat: Ping/Pong every 30s

**Tool Router (`router.ts`)**
- Receives `CommandRequest` → validates tool name → forwards to extension WS → awaits response → returns to agent
- Stateless forwarding; daemon does not implement tool logic

**Session Manager (`session.ts`)**
- `agentConnections: Map<agentId, WebSocket>` — agent connections
- `tabSessions: Map<sessionName, tabId[]>` — browser session → tab list
- `pendingRequests: Map<messageId, Deferred>` — pending request queue

### 4.3 Multi-Agent Adapters

| Adapter | Protocol | Address | Target Agent |
|---------|----------|---------|--------------|
| WebSocket | wsjson | `ws://localhost:10086/selector/command` | Kimi Code, Claude Code (skill), custom agents |
| MCP | stdio | `qweb-bridge mcp` | Claude Desktop, Cursor, Codex |
| HTTP REST | JSON | `http://localhost:10086/api/tool/:name` | Scripts, Python agents |
| CLI | Shell | `qweb-bridge <tool> [params]` | Shell scripts, manual testing |

**MCP Tool Mapping**: All 16 tools exposed with `browser_` prefix (e.g. `browser_navigate`, `browser_snapshot`).

### 4.4 Installer (`install.ts`)

```
qweb-bridge install:
  1. Detect Node.js environment
  2. Build/compile daemon
  3. Register launchd service (macOS) or systemd (Linux)
  4. Generate identity.json ({device_id})
  5. Output Chrome extension installation instructions
```

## 5. Chrome Extension (`packages/extension`)

### 5.1 Directory Structure

```
packages/extension/
├── src/
│   ├── background.ts           # Service Worker entry (WS connect, message routing)
│   ├── cdp/
│   │   └── controller.ts       # chrome.debugger wrapper (attach/detach/sendCommand)
│   ├── tools/
│   │   ├── index.ts            # Tool registry (16 tool → executor map)
│   │   ├── navigate.ts         # Navigate / new tab / session grouping / wait for load
│   │   ├── snapshot.ts         # A11y tree builder (DOM.getDocument + recursion)
│   │   ├── screenshot.ts       # Page.captureScreenshot
│   │   ├── click.ts            # DOM click + mouse event fallback
│   │   ├── mouse_click.ts      # Input.dispatchMouseEvent (real mouse events)
│   │   ├── fill.ts             # Form fill (native setter + contenteditable)
│   │   ├── evaluate.ts         # Runtime.evaluate
│   │   ├── key_type.ts         # Input.dispatchKeyEvent (character typing)
│   │   ├── send_keys.ts        # Input.dispatchKeyEvent (key combinations)
│   │   ├── upload.ts           # DOM.setFileInputFiles
│   │   ├── network.ts          # Network event listener (start/stop/list/detail)
│   │   ├── tabs.ts             # find_tab / list_tabs / close_tab / close_session
│   │   └── save_as_pdf.ts      # Page.printToPDF
│   ├── tab-manager.ts          # Tab lifecycle + session group color coding
│   ├── ref-store.ts            # @eN element ref cache (backendDOMNodeId map)
│   └── utils.ts                # Utility functions (selector parsing, etc.)
├── static/
│   ├── manifest.json
│   ├── popup.html
│   ├── icon/                   # 16/32/48/128 icons
│   └── _locales/
├── package.json
├── tsconfig.json
└── vite.config.ts              # Vite build for MV3 extension
```

### 5.2 Manifest

```json
{
  "manifest_version": 3,
  "name": "QwebBridge",
  "version": "1.0.0",
  "permissions": [
    "tabs",
    "activeTab",
    "debugger",
    "storage",
    "alarms",
    "tabGroups",
    "windows"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

### 5.3 Core Components

**Service Worker (`background.ts`)**
- Connects to daemon WebSocket
- Parses `CommandRequest` → dispatches to `toolRegistry.execute(tool, params)` → sends `CommandResponse`

**CDP Controller (`cdp/controller.ts`)**
- Wraps `chrome.debugger` API
- `attach(tabId)`, `detach(tabId)`, `send(method, params)`, `getActiveTab()`
- Tracks attached tabs in `Set<number>`

**Tool Registry (`tools/index.ts`)**
- `Map<string, ToolExecutor>` mapping tool name to executor class
- Each tool implements: `{ name: string; execute(params): Promise<unknown> }`

**Snapshot (`tools/snapshot.ts`)**
- Calls `DOM.getDocument(depth: -1)`
- Recursively parses a11y tree
- Filters `role=none/generic` non-leaf nodes
- Generates `@e0`, `@e1`, ... element references
- Stores in ref-store: `Map<refName, {backendDOMNodeId}>`

**Tab Manager (`tab-manager.ts`)**
- Session → tab group mapping
- Color-coded tab groups by agent session name
- Tab lifecycle event listeners
- Active tab tracking

**Key Tool Implementation Details**

`fill`: Uses native value setter via `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)` for React compatibility. Falls back to direct `.value =` assignment. Dispatches `input` and `change` events. For contenteditable elements, uses `document.execCommand('insertText')` with `textContent` fallback.

`click`: Resolves `@eN` refs via `DOM.resolveNode` → `backendDOMNodeId`. For CSS selectors, evaluates `document.querySelector()`. Scrolls into view, then calls `.click()`.

`mouse_click`: Gets box model via `DOM.getBoxModel`, computes center coordinates, dispatches `mouseMoved` → `mousePressed` → `mouseReleased` events via `Input.dispatchMouseEvent`.

`key_type`: Dispatches `Input.dispatchKeyEvent` with `type: 'char'` for each character in the text.

`send_keys`: Dispatches `Input.dispatchKeyEvent` with `type: 'rawKeyDown'` and `'keyUp'` for the given key combination.

## 6. Error Handling

### 6.1 Error Codes

| Code | Description |
|------|-------------|
| `tool_not_found` | Tool name not in registry |
| `tab_not_found` | No active tab / tab not found |
| `element_not_found` | Selector / ref not found on page |
| `invalid_params` | Missing or invalid tool parameters |
| `cdp_error` | Chrome DevTools Protocol error |
| `session_closed` | Agent session disconnected |
| `extension_disconnected` | Extension WebSocket lost |
| `no_extension_connected` | No extension connected to daemon |
| `navigation_failed` | Page navigation failed |

### 6.2 Error Flow

```
Tool execution fails
  → Tool executor throws Error with details
  → Extension sends CommandResponse with error
  → Daemon maps to ErrorDetail and returns to agent
  → Agent receives structured error with code + message
```

## 7. Testing Strategy

### 7.1 Unit Tests (Vitest)

- **protocol**: Type validation, message serialization round-trip
- **daemon**: Router logic, session manager, message encoding/decoding
- **extension**: Individual tool logic (mocked CDP), ref-store, tab-manager

### 7.2 Integration Tests

- **daemon ↔ extension**: End-to-end WebSocket message flow with mock CDP
- **agent ↔ daemon**: Full tool call lifecycle with mock extension

### 7.3 E2E Tests (Playwright + Chrome)

- Actual Chrome browser automation with installed extension
- Covering all 16 tools against real web pages

## 8. Build & Distribution

### 8.1 Build

- **protocol**: `tsc` (pure TypeScript)
- **daemon**: `tsup` → single executable Node.js binary
- **extension**: `vite` → MV3 extension bundle

### 8.2 Distribution

- **npm**: `@qweb/protocol`, `@qweb/daemon`, `@qweb/extension`
- **One-click install**: `curl -fsSL https://.../install.sh | bash`
- **Chrome Web Store**: Extension package submission
- **Homebrew**: macOS package for daemon

## 9. Open Questions / Future Work

- Protocol version negotiation (currently assume v1)
- Support for Firefox (WebExtensions API differences)
- Support for Edge browser
- Daemon auto-update mechanism
- Multi-browser session orchestration
- Recording & replay of browser interactions
