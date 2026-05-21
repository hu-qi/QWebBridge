# QwebBridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript monorepo for a browser extension + local daemon that lets AI agents control Chrome via CDP.

**Architecture:** Three packages in a pnpm monorepo: `protocol` (shared types), `daemon` (Node.js WebSocket server on localhost:10086), `extension` (Chrome MV3 extension with 16 CDP tools). Agent ↔ Daemon ↔ Extension ↔ Browser.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, Vite (extension), tsup (daemon), WebSocket (ws library), Chrome Extension MV3.

---

## Stage 1: Project Scaffolding

### Task 1.1: Initialize pnpm monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `tsconfig.base.json`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "qweb-bridge",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck"
  }
}
```

Write to `package.json`.

- [ ] **Step 2: Create workspace config**

```yaml
packages:
  - "packages/*"
```

Write to `pnpm-workspace.yaml`.

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
.DS_Store
```

Write to `.gitignore`.

- [ ] **Step 4: Create base tsconfig**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

Write to `tsconfig.base.json`.

- [ ] **Step 5: Initialize git and commit**

```bash
git init && git add -A && git commit -m "chore: initialize monorepo scaffold"
```

### Task 1.2: Set up linting and formatting

**Files:**
- Create: `.editorconfig`
- Modify: `package.json`

- [ ] **Step 1: Add ESLint + Prettier deps to root**

```bash
pnpm add -D -w eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-config-prettier
```

- [ ] **Step 2: Create ESLint config**

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  "env": { "node": true, "es2022": true },
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
}
```

Write to `.eslintrc.json`.

- [ ] **Step 3: Add lint/typecheck scripts to root package.json**

Edit `package.json`, add to scripts:
```json
{
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "eslint 'packages/*/src/**/*.ts'",
    "typecheck": "pnpm -r typecheck",
    "format": "prettier --write 'packages/*/src/**/*.ts'"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: add ESLint and Prettier config"
```

---

## Stage 2: Protocol Package

### Task 2.1: Create protocol package structure

**Files:**
- Create: `packages/protocol/package.json`
- Create: `packages/protocol/tsconfig.json`
- Create: `packages/protocol/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@qweb/protocol",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

Write to `packages/protocol/package.json`.

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

Write to `packages/protocol/tsconfig.json`.

- [ ] **Step 3: Create empty index.ts**

```typescript
export {};
```

Write to `packages/protocol/src/index.ts`.

- [ ] **Step 4: Install deps**

```bash
pnpm install
```

- [ ] **Step 5: Build to verify**

```bash
pnpm --filter @qweb/protocol build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold protocol package"
```

### Task 2.2: Define core message types

**Files:**
- Create: `packages/protocol/src/types.ts`
- Modify: `packages/protocol/src/index.ts`

- [ ] **Step 1: Write message type definitions**

```typescript
// === Identity ===

export interface DeviceIdentity {
  device_id: string;
}

// === Message Envelope ===

export type MessageType = "hello" | "command" | "response" | "error" | "event";

export interface Message<T = unknown> {
  id: string;
  type: MessageType;
  payload: T;
}

// === Hello (Handshake) ===

export interface HelloPayload {
  agent?: string;
  version?: string;
  capabilities?: string[];
}

// === Command ===

export interface CommandRequest {
  tool: string;
  params: Record<string, unknown>;
  session?: string;
}

export interface CommandResponse<T = unknown> {
  result: T;
}

// === Error ===

export interface ErrorDetail {
  code: string;
  message: string;
  details?: string;
}

// === Event (alive ping, etc.) ===

export interface DaemonAliveEvent {
  arch: string;
  daemon_version: string;
  os: string;
}
```

Write to `packages/protocol/src/types.ts`.

- [ ] **Step 2: Re-export from index.ts**

Edit `packages/protocol/src/index.ts`:
```typescript
export * from "./types.js";
```

- [ ] **Step 3: Build to verify types compile**

```bash
pnpm --filter @qweb/protocol build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(protocol): define core message types"
```

### Task 2.3: Define tool param/result types

**Files:**
- Create: `packages/protocol/src/tools.ts`
- Modify: `packages/protocol/src/index.ts`

- [ ] **Step 1: Write tool type definitions**

```typescript
// === Navigate ===
export interface NavigateParams {
  url: string;
  newTab?: boolean;
  _session?: string;
  group_title?: string;
}
export interface NavigateResult {
  success: boolean;
  url: string;
  tabId: number;
}

// === Snapshot ===
export interface SnapshotElement {
  role: string;
  name?: string;
  value?: string;
  ref: string;
  children?: SnapshotElement[];
}
export type SnapshotResult = SnapshotElement[];

// === Screenshot ===
export interface ScreenshotParams {
  format?: "png" | "jpeg" | "webp";
  quality?: number;
  fullPage?: boolean;
  selector?: string;
  element?: string;
}
export interface ScreenshotResult {
  success: boolean;
  data?: string;
  filePath?: string;
}

// === Click ===
export interface ClickParams {
  selector: string;
}
export interface ClickResult {
  success: boolean;
  tag: string;
  text: string;
}

// === Fill ===
export interface FillParams {
  selector: string;
  value: string;
}
export interface FillResult {
  success: boolean;
  tag: string;
  mode: "value" | "contenteditable";
}

// === Evaluate ===
export interface EvaluateParams {
  code: string;
}
export type EvaluateResult = unknown;

// === MouseClick ===
export interface MouseClickParams {
  selector: string;
}
export interface MouseClickResult {
  success: boolean;
  x: number;
  y: number;
  tag: string;
  text: string;
}

// === KeyType ===
export interface KeyTypeParams {
  text: string;
}
export interface KeyTypeResult {
  success: boolean;
}

// === SendKeys ===
export interface SendKeysParams {
  keys: string;
}
export interface SendKeysResult {
  success: boolean;
}

// === Upload ===
export interface UploadParams {
  selector: string;
  filePath?: string;
  files?: string[];
}
export interface UploadResult {
  success: boolean;
}

// === Network ===
export type NetworkCmd = "start" | "stop" | "list" | "detail";
export interface NetworkParams {
  cmd: NetworkCmd;
  filter?: string;
  requestId?: string;
}
export interface NetworkRequest {
  requestId: string;
  url: string;
  method: string;
  status?: number;
  type: string;
  timestamp: number;
}
export interface NetworkListResult {
  requests: NetworkRequest[];
}
export interface NetworkDetailResult {
  request: NetworkRequest;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
}
export type NetworkResult = { success: boolean } | NetworkListResult | NetworkDetailResult;

// === Tab management ===
export interface FindTabParams {
  url: string;
  _session?: string;
}
export interface TabInfo {
  tabId: number;
  url: string;
  title: string;
  active: boolean;
}
export interface FindTabResult {
  tabId: number;
  url: string;
  title: string;
}
export interface ListTabsParams {
  _tabIds?: number[];
  _session?: string;
}
export interface ListTabsResult {
  tabs: TabInfo[];
}
export interface CloseTabParams {
  _tabId: number;
}
export interface CloseSessionParams {
  _tabIds?: number[];
  _session?: string;
}
export interface SuccessResult {
  success: boolean;
}

// === SaveAsPdf ===
export interface SaveAsPdfParams {
  filePath?: string;
}
export interface SaveAsPdfResult {
  success: boolean;
  filePath?: string;
}

// === Tool parmas/result union ===
export type ToolParams =
  | NavigateParams
  | ScreenshotParams
  | ClickParams
  | FillParams
  | EvaluateParams
  | MouseClickParams
  | KeyTypeParams
  | SendKeysParams
  | UploadParams
  | NetworkParams
  | FindTabParams
  | ListTabsParams
  | CloseTabParams
  | CloseSessionParams
  | SaveAsPdfParams
  | Record<string, unknown>;

export type ToolResult =
  | NavigateResult
  | SnapshotResult
  | ScreenshotResult
  | ClickResult
  | FillResult
  | EvaluateResult
  | MouseClickResult
  | KeyTypeResult
  | SendKeysResult
  | UploadResult
  | NetworkResult
  | FindTabResult
  | ListTabsResult
  | SuccessResult
  | SaveAsPdfResult
  | unknown;
```

Write to `packages/protocol/src/tools.ts`.

- [ ] **Step 2: Update index.ts**

Edit `packages/protocol/src/index.ts`:
```typescript
export * from "./types.js";
export * from "./tools.js";
```

- [ ] **Step 3: Build to verify**

```bash
pnpm --filter @qweb/protocol build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(protocol): define all 16 tool param/result types"
```

### Task 2.4: Define constants

**Files:**
- Create: `packages/protocol/src/constants.ts`
- Modify: `packages/protocol/src/index.ts`

- [ ] **Step 1: Write constants**

```typescript
export const TOOL_NAMES = [
  "navigate",
  "snapshot",
  "screenshot",
  "click",
  "fill",
  "evaluate",
  "mouse_click",
  "key_type",
  "send_keys",
  "upload",
  "network",
  "find_tab",
  "list_tabs",
  "close_tab",
  "close_session",
  "save_as_pdf",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export const ERROR_CODES = {
  TOOL_NOT_FOUND: "tool_not_found",
  TAB_NOT_FOUND: "tab_not_found",
  ELEMENT_NOT_FOUND: "element_not_found",
  INVALID_PARAMS: "invalid_params",
  CDP_ERROR: "cdp_error",
  SESSION_CLOSED: "session_closed",
  EXTENSION_DISCONNECTED: "extension_disconnected",
  NO_EXTENSION_CONNECTED: "no_extension_connected",
  NAVIGATION_FAILED: "navigation_failed",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const DAEMON_PORT = 10086;
export const WS_PATH = "selector/command";
export const HEARTBEAT_INTERVAL_MS = 30_000;

export const TAB_GROUP_COLORS: Record<string, string> = {
  twitter: "blue",
  xhs: "red",
  zhihu: "blue",
  worldquant: "purple",
};

export const FALLBACK_COLORS = [
  "green",
  "yellow",
  "cyan",
  "orange",
  "pink",
  "grey",
] as const;
```

Write to `packages/protocol/src/constants.ts`.

- [ ] **Step 2: Update index.ts**

Edit `packages/protocol/src/index.ts`:
```typescript
export * from "./types.js";
export * from "./tools.js";
export * from "./constants.js";
```

- [ ] **Step 3: Build**

```bash
pnpm --filter @qweb/protocol build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(protocol): add constants - tool names, error codes, config"
```

### Task 2.5: Write protocol validation tests

**Files:**
- Create: `packages/protocol/src/__tests__/validation.test.ts`

- [ ] **Step 1: Write protocol validation tests**

```typescript
import { describe, it, expect } from "vitest";
import { TOOL_NAMES, ERROR_CODES, DAEMON_PORT, WS_PATH } from "../constants.js";
import type { Message, CommandRequest, CommandResponse, ErrorDetail, HelloPayload } from "../types.js";

describe("Constants", () => {
  it("should have exactly 16 tool names", () => {
    expect(TOOL_NAMES).toHaveLength(16);
  });

  it("should have all required tool names", () => {
    expect(TOOL_NAMES).toContain("navigate");
    expect(TOOL_NAMES).toContain("snapshot");
    expect(TOOL_NAMES).toContain("screenshot");
    expect(TOOL_NAMES).toContain("click");
    expect(TOOL_NAMES).toContain("fill");
    expect(TOOL_NAMES).toContain("evaluate");
    expect(TOOL_NAMES).toContain("mouse_click");
    expect(TOOL_NAMES).toContain("key_type");
    expect(TOOL_NAMES).toContain("send_keys");
    expect(TOOL_NAMES).toContain("upload");
    expect(TOOL_NAMES).toContain("network");
    expect(TOOL_NAMES).toContain("find_tab");
    expect(TOOL_NAMES).toContain("list_tabs");
    expect(TOOL_NAMES).toContain("close_tab");
    expect(TOOL_NAMES).toContain("close_session");
    expect(TOOL_NAMES).toContain("save_as_pdf");
  });

  it("should define all error codes", () => {
    expect(Object.keys(ERROR_CODES)).toHaveLength(9);
  });

  it("should use correct port", () => {
    expect(DAEMON_PORT).toBe(10086);
  });

  it("should use correct WS path", () => {
    expect(WS_PATH).toBe("selector/command");
  });
});

describe("Message serialization round-trip", () => {
  it("should serialize and deserialize Hello message", () => {
    const msg: Message<HelloPayload> = {
      id: "1",
      type: "hello",
      payload: { agent: "claude-code", version: "1.0" },
    };
    const json = JSON.stringify(msg);
    const parsed = JSON.parse(json) as Message<HelloPayload>;
    expect(parsed.type).toBe("hello");
    expect(parsed.payload.agent).toBe("claude-code");
  });

  it("should serialize and deserialize Command message", () => {
    const msg: Message<CommandRequest> = {
      id: "2",
      type: "command",
      payload: {
        tool: "navigate",
        params: { url: "https://example.com" },
        session: "test-session",
      },
    };
    const json = JSON.stringify(msg);
    const parsed = JSON.parse(json) as Message<CommandRequest>;
    expect(parsed.type).toBe("command");
    expect(parsed.payload.tool).toBe("navigate");
    expect(parsed.payload.session).toBe("test-session");
  });

  it("should serialize and deserialize Response message", () => {
    const msg: Message<CommandResponse> = {
      id: "2",
      type: "response",
      payload: { result: { success: true, url: "https://example.com", tabId: 42 } },
    };
    const json = JSON.stringify(msg);
    const parsed = JSON.parse(json) as Message<CommandResponse>;
    expect(parsed.type).toBe("response");
  });

  it("should serialize and deserialize Error message", () => {
    const msg: Message<ErrorDetail> = {
      id: "3",
      type: "error",
      payload: { code: "tool_not_found", message: "Unknown tool: foo" },
    };
    const json = JSON.stringify(msg);
    const parsed = JSON.parse(json) as Message<ErrorDetail>;
    expect(parsed.type).toBe("error");
    expect(parsed.payload.code).toBe("tool_not_found");
  });
});
```

Write to `packages/protocol/src/__tests__/validation.test.ts`.

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @qweb/protocol test --run
```

Expected: All 8 tests pass.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test(protocol): add validation and serialization tests"
```

---

## Stage 3: Daemon Package

### Task 3.1: Create daemon package structure

**Files:**
- Create: `packages/daemon/package.json`
- Create: `packages/daemon/tsconfig.json`
- Create: `packages/daemon/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@qweb/daemon",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "bin": {
    "qweb-bridge": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@qweb/protocol": "workspace:*",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.12",
    "tsup": "^8.2.0",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

Write to `packages/daemon/package.json`.

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

Write to `packages/daemon/tsconfig.json`.

- [ ] **Step 3: Create tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli/cli.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node18",
  platform: "node",
});
```

Write to `packages/daemon/tsup.config.ts`.

- [ ] **Step 4: Create index.ts placeholder**

```typescript
export { createServer } from "./server.js";
```

Write to `packages/daemon/src/index.ts`.

- [ ] **Step 5: Install deps**

```bash
pnpm install
```

- [ ] **Step 6: Build to verify**

```bash
pnpm --filter @qweb/daemon build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold daemon package"
```

### Task 3.2: Config manager

**Files:**
- Create: `packages/daemon/src/config.ts`
- Create: `packages/daemon/src/__tests__/config.test.ts`

- [ ] **Step 1: Write config.ts**

```typescript
import { homedir } from "os";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { randomBytes } from "crypto";
import type { DeviceIdentity } from "@qweb/protocol";

const CONFIG_DIR = join(homedir(), ".qweb-bridge");
const IDENTITY_FILE = join(CONFIG_DIR, "identity.json");
const PID_FILE = join(CONFIG_DIR, "daemon.pid");
const LOG_DIR = join(CONFIG_DIR, "logs");

export interface DaemonConfig {
  port: number;
  identity: DeviceIdentity;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function generateDeviceId(): string {
  return randomBytes(12).toString("base64url");
}

export function loadIdentity(): DeviceIdentity {
  ensureDir(CONFIG_DIR);
  if (existsSync(IDENTITY_FILE)) {
    const raw = readFileSync(IDENTITY_FILE, "utf-8");
    return JSON.parse(raw) as DeviceIdentity;
  }
  const identity: DeviceIdentity = { device_id: generateDeviceId() };
  writeFileSync(IDENTITY_FILE, JSON.stringify(identity));
  return identity;
}

export function loadConfig(): DaemonConfig {
  const identity = loadIdentity();
  return {
    port: 10086,
    identity,
  };
}

export function writePid(pid: number): void {
  ensureDir(CONFIG_DIR);
  writeFileSync(PID_FILE, String(pid));
}

export function getPidFile(): string {
  return PID_FILE;
}

export function getLogDir(): string {
  ensureDir(LOG_DIR);
  return LOG_DIR;
}

export { CONFIG_DIR };
```

Write to `packages/daemon/src/config.ts`.

- [ ] **Step 2: Write config tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const testDir = join(homedir(), ".qweb-bridge-test");

// Override CONFIG_DIR for testing
vi.mock("../config.js", async () => {
  const actual = await vi.importActual<typeof import("../config.js")>("../config.js");
  return { ...actual, CONFIG_DIR: testDir };
});

import { loadIdentity, generateDeviceId } from "../config.js";

describe("Config", () => {
  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it("generateDeviceId should return a non-empty string", () => {
    const id = generateDeviceId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("generateDeviceId should produce unique values", () => {
    const id1 = generateDeviceId();
    const id2 = generateDeviceId();
    expect(id1).not.toBe(id2);
  });
});
```

Write to `packages/daemon/src/__tests__/config.test.ts`.

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @qweb/daemon test --run
```

Expected: Config tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(daemon): add config manager with identity support"
```

### Task 3.3: Session manager

**Files:**
- Create: `packages/daemon/src/session.ts`
- Create: `packages/daemon/src/__tests__/session.test.ts`

- [ ] **Step 1: Write session.ts**

```typescript
import { randomUUID } from "crypto";
import type { WebSocket } from "ws";

interface AgentSession {
  id: string;
  ws: WebSocket;
  agentName?: string;
  connectedAt: number;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS = 60_000;

export class SessionManager {
  private agentSessions = new Map<string, AgentSession>();
  private extensionConnection: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private tabSessions = new Map<string, number[]>();

  addAgent(ws: WebSocket, agentName?: string): string {
    const id = randomUUID();
    this.agentSessions.set(id, { id, ws, agentName, connectedAt: Date.now() });
    return id;
  }

  removeAgent(id: string): void {
    this.agentSessions.delete(id);
  }

  getAgent(id: string): AgentSession | undefined {
    return this.agentSessions.get(id);
  }

  setExtension(ws: WebSocket): void {
    this.extensionConnection = ws;

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(msg.id);
          if (msg.type === "error") {
            pending.reject(new Error(msg.payload.message));
          } else {
            pending.resolve(msg.payload.result);
          }
        }
      } catch {
        // Ignore parse errors on relayed messages
      }
    });

    ws.on("close", () => {
      this.extensionConnection = null;
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timer);
        pending.reject(new Error("extension_disconnected"));
        this.pendingRequests.delete(id);
      }
    });
  }

  hasExtension(): boolean {
    return this.extensionConnection !== null;
  }

  async sendToExtension(message: unknown): Promise<unknown> {
    if (!this.extensionConnection) {
      throw new Error("no_extension_connected");
    }

    const msg = message as { id: string };
    const id = msg.id;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error("request_timeout"));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.extensionConnection!.send(JSON.stringify(message));
    });
  }

  addTabSession(sessionName: string, tabId: number): void {
    const tabs = this.tabSessions.get(sessionName) || [];
    if (!tabs.includes(tabId)) {
      tabs.push(tabId);
    }
    this.tabSessions.set(sessionName, tabs);
  }

  removeTabSession(sessionName: string, tabId: number): void {
    const tabs = this.tabSessions.get(sessionName);
    if (tabs) {
      const idx = tabs.indexOf(tabId);
      if (idx !== -1) {
        tabs.splice(idx, 1);
      }
      if (tabs.length === 0) {
        this.tabSessions.delete(sessionName);
      }
    }
  }

  getSessionTabs(sessionName: string): number[] {
    return this.tabSessions.get(sessionName) || [];
  }

  getAllTabs(): number[] {
    const all: number[] = [];
    for (const tabs of this.tabSessions.values()) {
      all.push(...tabs);
    }
    return all;
  }

  getAgentCount(): number {
    return this.agentSessions.size;
  }
}
```

Write to `packages/daemon/src/session.ts`.

- [ ] **Step 2: Write session tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { SessionManager } from "../session.js";

describe("SessionManager", () => {
  let sm: SessionManager;

  beforeEach(() => {
    sm = new SessionManager();
  });

  it("should add and get agent sessions", () => {
    const mockWs = {} as WebSocket;
    const id = sm.addAgent(mockWs, "test-agent");
    expect(id).toBeTruthy();
    expect(sm.getAgent(id)?.agentName).toBe("test-agent");
  });

  it("should remove agent sessions", () => {
    const mockWs = {} as WebSocket;
    const id = sm.addAgent(mockWs);
    sm.removeAgent(id);
    expect(sm.getAgent(id)).toBeUndefined();
  });

  it("should track extension connection", () => {
    expect(sm.hasExtension()).toBe(false);
    const mockWs = { on: () => {}, send: () => {} } as unknown as WebSocket;
    sm.setExtension(mockWs);
    expect(sm.hasExtension()).toBe(true);
  });

  it("should manage tab sessions", () => {
    sm.addTabSession("session-a", 1);
    sm.addTabSession("session-a", 2);
    sm.addTabSession("session-b", 3);

    expect(sm.getSessionTabs("session-a")).toEqual([1, 2]);
    expect(sm.getSessionTabs("session-b")).toEqual([3]);

    sm.removeTabSession("session-a", 1);
    expect(sm.getSessionTabs("session-a")).toEqual([2]);
  });

  it("should return agent count", () => {
    expect(sm.getAgentCount()).toBe(0);
    sm.addAgent({} as WebSocket);
    sm.addAgent({} as WebSocket);
    expect(sm.getAgentCount()).toBe(2);
  });

  it("should throw when sending to extension with no connection", async () => {
    await expect(sm.sendToExtension({ id: "test" })).rejects.toThrow(
      "no_extension_connected"
    );
  });
});
```

Write to `packages/daemon/src/__tests__/session.test.ts`.

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @qweb/daemon test --run
```

Expected: 6 tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(daemon): add session manager for agent/extension connections"
```

### Task 3.4: WebSocket server

**Files:**
- Create: `packages/daemon/src/server.ts`
- Create: `packages/daemon/src/__tests__/server.test.ts`

- [ ] **Step 1: Write server.ts**

```typescript
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createHttpServer } from "http";
import { DAEMON_PORT, WS_PATH } from "@qweb/protocol";
import { SessionManager } from "./session.js";
import { loadConfig } from "./config.js";
import type { Message, CommandRequest, ErrorDetail } from "@qweb/protocol";

export function createServer(sessionManager: SessionManager, port?: number): Promise<{ httpServer: ReturnType<typeof createHttpServer> }> {
  const config = loadConfig();
  const listenPort = port ?? config.port;

  const httpServer = createHttpServer((_req, res) => {
    res.writeHead(404);
    res.end("404 page not found");
  });

  const wss = new WebSocketServer({ server: httpServer, path: `/${WS_PATH}` });

  wss.on("connection", (ws: WebSocket, req) => {
    const userAgent = req.headers["user-agent"] || "";

    // Check if this is the extension connecting
    // Extension identifies itself via a header or a hello message
    let isExtension = false;
    let agentId: string | null = null;
    let handshakeDone = false;

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as Message;

        if (!handshakeDone && msg.type === "hello") {
          handshakeDone = true;
          const payload = msg.payload as { agent?: string };
          const agent = payload.agent || "";

          if (agent === "extension") {
            isExtension = true;
            sessionManager.setExtension(ws);
            ws.send(JSON.stringify({ id: msg.id, type: "response", payload: { result: { status: "connected" } } }));
            return;
          }

          agentId = sessionManager.addAgent(ws, agent);
          ws.send(JSON.stringify({ id: msg.id, type: "response", payload: { result: { status: "connected", session_id: agentId } } }));
          return;
        }

        if (!handshakeDone) {
          ws.send(JSON.stringify({
            id: msg.id || "unknown",
            type: "error",
            payload: { code: "protocol_error", message: "Hello message required before commands" },
          }));
          return;
        }

        if (msg.type === "command" && !isExtension) {
          const cmd = msg.payload as CommandRequest;
          // Forward command to extension and relay response
          sessionManager.sendToExtension(msg)
            .then((result) => {
              ws.send(JSON.stringify({
                id: msg.id,
                type: "response",
                payload: { result },
              }));
            })
            .catch((err: Error) => {
              ws.send(JSON.stringify({
                id: msg.id,
                type: "error",
                payload: { code: err.message, message: err.message },
              }));
            });
        }
      } catch {
        // Ignore parse errors
      }
    });

    ws.on("close", () => {
      if (agentId) {
        sessionManager.removeAgent(agentId);
      }
    });

    // Ping/pong keepalive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30_000);

    ws.on("close", () => {
      clearInterval(pingInterval);
    });
  });

  return new Promise((resolve) => {
    httpServer.listen(listenPort, "127.0.0.1", () => {
      console.log(`[qweb-bridge] Daemon listening on ws://127.0.0.1:${listenPort}/${WS_PATH}`);
      resolve({ httpServer });
    });
  });
}

export { DAEMON_PORT, WS_PATH };
```

Write to `packages/daemon/src/server.ts`.

- [ ] **Step 2: Write server test with WS client**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import { createServer } from "../server.js";
import { SessionManager } from "../session.js";
import { DAEMON_PORT } from "@qweb/protocol";
import type { Server } from "http";

const TEST_PORT = 10087;
const WS_URL = `ws://127.0.0.1:${TEST_PORT}/selector/command`;

describe("WebSocket Server", () => {
  let httpServer: Server;
  let sm: SessionManager;

  beforeAll(async () => {
    sm = new SessionManager();
    const result = await createServer(sm, TEST_PORT);
    httpServer = result.httpServer;
  });

  afterAll(() => {
    httpServer.close();
  });

  it("should accept WebSocket connections", async () => {
    const ws = new WebSocket(WS_URL);

    await new Promise<void>((resolve, reject) => {
      ws.on("open", resolve);
      ws.on("error", reject);
    });

    ws.close();
  });

  it("should respond to hello with connection confirmation", async () => {
    const ws = new WebSocket(WS_URL);

    await new Promise<void>((resolve) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({
          id: "1",
          type: "hello",
          payload: { agent: "test-agent" },
        }));
      });

      ws.on("message", (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        expect(msg.type).toBe("response");
        expect(msg.payload.result.status).toBe("connected");
        ws.close();
        resolve();
      });
    });
  });

  it("should require hello before commands", async () => {
    const ws = new WebSocket(WS_URL);

    await new Promise<void>((resolve) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({
          id: "2",
          type: "command",
          payload: { tool: "navigate", params: { url: "https://example.com" } },
        }));
      });

      ws.on("message", (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        expect(msg.type).toBe("error");
        expect(msg.payload.code).toBe("protocol_error");
        ws.close();
        resolve();
      });
    });
  });
});
```

Write to `packages/daemon/src/__tests__/server.test.ts`.

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @qweb/daemon test --run
```

Expected: 9 tests pass (6 from session + 3 from server).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(daemon): add WebSocket server with hello handshake"
```

### Task 3.5: CLI entry point

**Files:**
- Create: `packages/daemon/src/cli/cli.ts`
- Create: `packages/daemon/src/cli/shutdown.ts`

- [ ] **Step 1: Write CLI entry point**

```typescript
#!/usr/bin/env node

import { createServer } from "../server.js";
import { SessionManager } from "../session.js";
import { writePid, loadConfig } from "../config.js";

const command = process.argv[2];

async function main() {
  switch (command) {
    case "run": {
      const sm = new SessionManager();
      const { httpServer } = await createServer(sm);
      writePid(process.pid);

      const shutdown = () => {
        console.log("[qweb-bridge] Shutting down...");
        httpServer.close();
        process.exit(0);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
      break;
    }

    case "shutdown": {
      // Send shutdown request to running daemon
      const config = loadConfig();
      try {
        await fetch(`http://127.0.0.1:${config.port}/shutdown`, { method: "POST" });
        console.log("[qweb-bridge] Shutdown signal sent");
      } catch {
        console.log("[qweb-bridge] Daemon is not running");
      }
      process.exit(0);
      break;
    }

    case "install": {
      console.log("[qweb-bridge] Install instructions:");
      console.log("  1. Run: qweb-bridge run");
      console.log("  2. Load Chrome extension from packages/extension/dist");
      console.log("     Open chrome://extensions, enable Developer mode,");
      console.log("     click 'Load unpacked' and select the dist folder");
      break;
    }

    case "version":
    case "--version":
    case "-v": {
      console.log("qweb-bridge v1.0.0");
      break;
    }

    default: {
      console.log("qweb-bridge - Browser bridge for AI agents");
      console.log("");
      console.log("Usage: qweb-bridge <command>");
      console.log("");
      console.log("Commands:");
      console.log("  run        Start the daemon");
      console.log("  shutdown   Stop the daemon");
      console.log("  install    Show installation instructions");
      console.log("  version    Show version");
      break;
    }
  }
}

main().catch(console.error);
```

Write to `packages/daemon/src/cli/cli.ts`.

- [ ] **Step 2: Build and verify CLI works**

```bash
pnpm --filter @qweb/daemon build && node packages/daemon/dist/cli.js version
```

Expected: Output `qweb-bridge v1.0.0`.

- [ ] **Step 3: Verify --help output**

```bash
node packages/daemon/dist/cli.js
```

Expected: Usage help printed.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(daemon): add CLI entry point with run/shutdown/install commands"
```

### Task 3.6: HTTP REST adapter

**Files:**
- Create: `packages/daemon/src/adapters/http.ts`
- Modify: `packages/daemon/src/server.ts`

- [ ] **Step 1: Write HTTP adapter**

```typescript
import type { IncomingMessage, ServerResponse } from "http";
import type { SessionManager } from "../session.js";
import { TOOL_NAMES } from "@qweb/protocol";

type ToolName = (typeof TOOL_NAMES)[number];

function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

export function handleHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessionManager: SessionManager
): boolean {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  // Health check
  if (url.pathname === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", extensions_connected: sessionManager.hasExtension() }));
    return true;
  }

  // Tool API: POST /api/tool/:name
  const toolMatch = url.pathname.match(/^\/api\/tool\/(\w+)$/);
  if (toolMatch && req.method === "POST") {
    const toolName = toolMatch[1];
    if (!isToolName(toolName)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unknown_tool", message: `Unknown tool: ${toolName}`, available_tools: TOOL_NAMES }));
      return true;
    }

    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      try {
        const params = body ? JSON.parse(body) : {};
        const id = `http-${Date.now()}`;
        const commandMsg = {
          id,
          type: "command",
          payload: { tool: toolName, params },
        };

        const result = await sessionManager.sendToExtension(commandMsg);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, result }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: message }));
      }
    });
    return true;
  }

  return false;
}
```

Write to `packages/daemon/src/adapters/http.ts`.

- [ ] **Step 2: Integrate HTTP adapter into server.ts**

Edit `packages/daemon/src/server.ts`, add import and modify the HTTP handler:

Add import at top:
```typescript
import { handleHttpRequest } from "./adapters/http.js";
```

Change the HTTP createServer callback from:
```typescript
  const httpServer = createHttpServer((_req, res) => {
    res.writeHead(404);
    res.end("404 page not found");
  });
```
To:
```typescript
  const httpServer = createHttpServer((req, res) => {
    if (handleHttpRequest(req, res, sessionManager)) return;

    if (req.url === "/shutdown" && req.method === "POST") {
      res.writeHead(200);
      res.end("OK");
      httpServer.close();
      process.exit(0);
      return;
    }

    res.writeHead(404);
    res.end("404 page not found");
  });
```

- [ ] **Step 3: Build to verify**

```bash
pnpm --filter @qweb/daemon build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(daemon): add HTTP REST adapter for tool API"
```

---

## Stage 4: Extension Package

### Task 4.1: Create extension package structure

**Files:**
- Create: `packages/extension/package.json`
- Create: `packages/extension/tsconfig.json`
- Create: `packages/extension/vite.config.ts`
- Create: `packages/extension/static/manifest.json`
- Create: `packages/extension/static/popup.html`
- Create: `packages/extension/src/background.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@qweb/extension",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@qweb/protocol": "workspace:*"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.268",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

Write to `packages/extension/package.json`.

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome"]
  },
  "include": ["src"]
}
```

Write to `packages/extension/tsconfig.json`.

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        format: "iife",
      },
    },
  },
});
```

Write to `packages/extension/vite.config.ts`.

- [ ] **Step 4: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "QwebBridge",
  "version": "1.0.0",
  "description": "Browser bridge for AI agents",
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

Write to `packages/extension/static/manifest.json`.

- [ ] **Step 5: Create popup.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>QwebBridge</title>
  <style>
    body { width: 280px; padding: 16px; font-family: system-ui; font-size: 14px; }
    .status { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot.connected { background: #22c55e; }
    .dot.disconnected { background: #ef4444; }
    h2 { margin: 0 0 8px 0; font-size: 16px; }
    .info { color: #666; font-size: 12px; margin-bottom: 4px; }
  </style>
</head>
<body>
  <h2>QwebBridge</h2>
  <div class="status">
    <div id="status-dot" class="dot disconnected"></div>
    <span id="status-text">Disconnected</span>
  </div>
  <div class="info" id="info-text">Connect to daemon: qweb-bridge run</div>
  <script src="popup.js"></script>
</body>
</html>
```

Write to `packages/extension/static/popup.html`.

- [ ] **Step 6: Install deps**

```bash
pnpm install
```

- [ ] **Step 7: Build to verify**

```bash
pnpm --filter @qweb/extension build
```

Expected: Build succeeds (background.js placeholder may be empty).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: scaffold extension package with manifest and config"
```

### Task 4.2: CDP Controller

**Files:**
- Create: `packages/extension/src/cdp/controller.ts`
- Create: `packages/extension/src/__tests__/cdp.test.ts`

- [ ] **Step 1: Write CDP controller**

```typescript
export class CDPController {
  private attachedTabs = new Set<number>();
  private currentTabId: number | null = null;
  private fallbackTabId: number | null = null;

  async attach(tabId: number): Promise<void> {
    if (this.attachedTabs.has(tabId)) {
      this.currentTabId = tabId;
      return;
    }

    try {
      await chrome.debugger.detach({ tabId });
    } catch {
      // Tab may not be attached
    }

    await chrome.debugger.attach({ tabId }, "1.3");
    this.attachedTabs.add(tabId);
    this.currentTabId = tabId;
  }

  async detach(tabId: number): Promise<void> {
    try {
      await chrome.debugger.detach({ tabId });
    } catch {
      // Tab may already be detached
    }
    this.attachedTabs.delete(tabId);
    if (this.currentTabId === tabId) {
      this.currentTabId = null;
    }
  }

  async send<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const tabId = this.currentTabId;
    if (tabId === null) {
      throw new Error("No tab attached. Call attach(tabId) first.");
    }
    return (await chrome.debugger.sendCommand({ tabId }, method, params as Record<string, never>)) as T;
  }

  getCurrentTabId(): number | null {
    return this.currentTabId;
  }

  setFallbackTab(tabId: number): void {
    this.fallbackTabId = tabId;
  }

  async getActiveTab(): Promise<chrome.tabs.Tab> {
    // Try current attached tab first
    if (this.currentTabId !== null) {
      try {
        const tab = await chrome.tabs.get(this.currentTabId);
        if (tab) return tab;
      } catch {
        this.attachedTabs.delete(this.currentTabId);
        this.currentTabId = null;
      }
    }

    // Try fallback tab
    if (this.fallbackTabId !== null) {
      try {
        const tab = await chrome.tabs.get(this.fallbackTabId);
        if (tab) return tab;
      } catch {
        this.fallbackTabId = null;
      }
    }

    // Query active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("No active tab found");
    }
    this.fallbackTabId = tab.id;
    return tab;
  }
}
```

Write to `packages/extension/src/cdp/controller.ts`.

- [ ] **Step 2: Write controller unit test (mock chrome API)**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CDPController } from "../cdp/controller.js";

const mockDebuggerSend = vi.fn();
const mockTabsGet = vi.fn();
const mockTabsQuery = vi.fn();

// Mock chrome API
(globalThis as Record<string, unknown>).chrome = {
  debugger: {
    attach: vi.fn().mockResolvedValue(undefined),
    detach: vi.fn().mockResolvedValue(undefined),
    sendCommand: (_target: { tabId: number }, method: string, params?: Record<string, never>) => {
      return mockDebuggerSend(method, params);
    },
  },
  tabs: {
    get: (tabId: number) => mockTabsGet(tabId),
    query: (info: chrome.tabs.QueryInfo) => mockTabsQuery(info),
  },
};

describe("CDPController", () => {
  let controller: CDPController;

  beforeEach(() => {
    controller = new CDPController();
    mockDebuggerSend.mockReset();
    mockTabsGet.mockReset();
    mockTabsQuery.mockReset();
  });

  it("should attach to a tab", async () => {
    await controller.attach(42);
    expect(controller.getCurrentTabId()).toBe(42);
  });

  it("should throw when sending without attached tab", async () => {
    await expect(controller.send("Runtime.evaluate", { expression: "1+1" }))
      .rejects.toThrow("No tab attached");
  });

  it("should send CDP commands", async () => {
    mockDebuggerSend.mockResolvedValue({ result: { value: 42 } });
    await controller.attach(42);
    const result = await controller.send<{ result: { value: number } }>(
      "Runtime.evaluate",
      { expression: "40+2" }
    );
    expect(result.result.value).toBe(42);
    expect(mockDebuggerSend).toHaveBeenCalledWith("Runtime.evaluate", { expression: "40+2" });
  });

  it("should detach from a tab", async () => {
    await controller.attach(42);
    await controller.detach(42);
    expect(controller.getCurrentTabId()).toBeNull();
  });

  it("should get active tab from query when no attached tab", async () => {
    mockTabsQuery.mockResolvedValue([{ id: 99, url: "https://example.com" }]);
    const tab = await controller.getActiveTab();
    expect(tab.id).toBe(99);
  });
});
```

Write to `packages/extension/src/__tests__/cdp.test.ts`.

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @qweb/extension test --run
```

Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(extension): add CDP controller with chrome.debugger wrapper"
```

### Task 4.3: Ref Store and Tab Manager

**Files:**
- Create: `packages/extension/src/ref-store.ts`
- Create: `packages/extension/src/tab-manager.ts`
- Create: `packages/extension/src/__tests__/ref-store.test.ts`
- Create: `packages/extension/src/__tests__/tab-manager.test.ts`

- [ ] **Step 1: Write ref-store.ts**

```typescript
interface RefEntry {
  backendDOMNodeId: number;
}

export class RefStore {
  private refs = new Map<string, RefEntry>();

  set(ref: string, backendDOMNodeId: number): void {
    this.refs.set(ref, { backendDOMNodeId });
  }

  get(ref: string): RefEntry | undefined {
    return this.refs.get(ref);
  }

  resolveRef(ref: string): string {
    // Accept @eN format or plain eN
    return ref.startsWith("@") ? ref.slice(1) : ref;
  }

  isRef(value: string): boolean {
    return /^@?e\d+$/.test(value);
  }

  clear(): void {
    this.refs.clear();
  }

  get size(): number {
    return this.refs.size;
  }
}
```

Write to `packages/extension/src/ref-store.ts`.

- [ ] **Step 2: Write tab-manager.ts**

```typescript
import { TAB_GROUP_COLORS, FALLBACK_COLORS } from "@qweb/protocol";

const sessionGroups = new Map<string, number>();
let colorIndex = 0;

// Track attached tabs for cleanup
const attachedTabs = new Set<number>();

chrome.tabs.onRemoved.addListener((tabId) => {
  attachedTabs.delete(tabId);
});

chrome.debugger.onDetach.addListener(({ tabId }) => {
  if (tabId) attachedTabs.delete(tabId);
});

export async function groupTab(
  tabIds: number | number[],
  sessionName: string,
  groupTitle?: string
): Promise<void> {
  const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
  const existingGroup = sessionGroups.get(sessionName);

  if (existingGroup != null) {
    await chrome.tabs.group({ tabIds: ids, groupId: existingGroup });
    return;
  }

  const color = TAB_GROUP_COLORS[sessionName] ?? FALLBACK_COLORS[colorIndex++ % FALLBACK_COLORS.length];
  const title = groupTitle ?? `agent:${sessionName}`;

  const groupId = await chrome.tabs.group({ tabIds: ids });
  await chrome.tabGroups.update(groupId, { title, color, collapsed: false });
  sessionGroups.set(sessionName, groupId);
}

export function trackTab(tabId: number): void {
  attachedTabs.add(tabId);
}

export function untrackTab(tabId: number): void {
  attachedTabs.delete(tabId);
}

export function getAttachedTabs(): Set<number> {
  return attachedTabs;
}

export function clearSessionGroup(sessionName: string): void {
  sessionGroups.delete(sessionName);
}
```

Write to `packages/extension/src/tab-manager.ts`.

- [ ] **Step 3: Write ref-store test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { RefStore } from "../ref-store.js";

describe("RefStore", () => {
  let store: RefStore;

  beforeEach(() => {
    store = new RefStore();
  });

  it("should store and retrieve refs", () => {
    store.set("e0", 123);
    expect(store.get("e0")?.backendDOMNodeId).toBe(123);
  });

  it("should detect ref strings", () => {
    expect(store.isRef("@e0")).toBe(true);
    expect(store.isRef("e0")).toBe(true);
    expect(store.isRef("#main")).toBe(false);
    expect(store.isRef("div.class")).toBe(false);
  });

  it("should resolve ref names", () => {
    expect(store.resolveRef("@e0")).toBe("e0");
    expect(store.resolveRef("e0")).toBe("e0");
  });

  it("should return undefined for unknown refs", () => {
    expect(store.get("e999")).toBeUndefined();
  });

  it("should clear all refs", () => {
    store.set("e0", 1);
    store.set("e1", 2);
    store.clear();
    expect(store.size).toBe(0);
  });
});
```

Write to `packages/extension/src/__tests__/ref-store.test.ts`.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @qweb/extension test --run
```

Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(extension): add ref store and tab manager"
```

### Task 4.4: Tool Registry + Core Tools

**Files:**
- Create: `packages/extension/src/tools/index.ts`
- Create: `packages/extension/src/tools/navigate.ts`
- Create: `packages/extension/src/tools/evaluate.ts`
- Create: `packages/extension/src/tools/screenshot.ts`
- Create: `packages/extension/src/tools/save-as-pdf.ts`

- [ ] **Step 1: Write tool registry interface and registration**

```typescript
import type { CDPController } from "../cdp/controller.js";
import type { RefStore } from "../ref-store.js";

export interface ToolContext {
  cdp: CDPController;
  refs: RefStore;
}

export interface ToolExecutor {
  name: string;
  execute(params: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
}

const registry = new Map<string, ToolExecutor>();

export function registerTool(executor: ToolExecutor): void {
  registry.set(executor.name, executor);
}

export function getTool(name: string): ToolExecutor | undefined {
  return registry.get(name);
}

export function getAllToolNames(): string[] {
  return Array.from(registry.keys());
}
```

Write to `packages/extension/src/tools/index.ts`.

- [ ] **Step 2: Write navigate tool**

```typescript
import { registerTool, type ToolExecutor } from "./index.js";
import { groupTab, trackTab } from "../tab-manager.js";

const navigateTool: ToolExecutor = {
  name: "navigate",
  async execute(params, ctx) {
    const url = params.url as string;
    if (!url) throw new Error("navigate: url is required");

    const newTab = params.newTab as boolean | undefined;
    const session = params._session as string | undefined;
    const groupTitle = params.group_title as string | undefined;

    if (newTab) {
      const tab = await chrome.tabs.create({ url, active: true });
      if (session) {
        await groupTab(tab.id!, session, groupTitle);
      }
      await ctx.cdp.attach(tab.id!);
      trackTab(tab.id!);
      await waitForLoad(tab.id!);
      return { success: true, url, tabId: tab.id! };
    }

    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);
    trackTab(tab.id!);
    await ctx.cdp.send("Page.navigate", { url });
    await waitForLoad(tab.id!);
    return { success: true, url, tabId: tab.id! };
  },
};

async function waitForLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const handler = (tabId2: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (tabId2 === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(handler);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(handler);
    // Timeout after 30s
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handler);
      resolve();
    }, 30_000);
  });
}

registerTool(navigateTool);
```

Write to `packages/extension/src/tools/navigate.ts`.

- [ ] **Step 3: Write evaluate tool**

```typescript
import { registerTool, type ToolExecutor } from "./index.js";

const evaluateTool: ToolExecutor = {
  name: "evaluate",
  async execute(params, ctx) {
    const code = params.code as string;
    if (!code) throw new Error("evaluate: code is required");

    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    const result = await ctx.cdp.send<{ result: { value: unknown }; exceptionDetails?: { text: string } }>(
      "Runtime.evaluate",
      {
        expression: code,
        returnByValue: true,
        awaitPromise: true,
      }
    );

    if (result.exceptionDetails) {
      throw new Error(`evaluate: ${result.exceptionDetails.text}`);
    }

    return result.result.value;
  },
};

registerTool(evaluateTool);
```

Write to `packages/extension/src/tools/evaluate.ts`.

- [ ] **Step 4: Write screenshot tool**

```typescript
import { registerTool, type ToolExecutor } from "./index.js";

const screenshotTool: ToolExecutor = {
  name: "screenshot",
  async execute(params, ctx) {
    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    const format = (params.format as string) || "png";
    const fullPage = params.fullPage as boolean | undefined;

    const result = await ctx.cdp.send<{ data: string }>("Page.captureScreenshot", {
      format: format as "png" | "jpeg" | "webp",
      quality: params.quality as number | undefined,
      captureBeyondViewport: fullPage ?? false,
      fromSurface: true,
    });

    return { success: true, data: result.data };
  },
};

registerTool(screenshotTool);
```

Write to `packages/extension/src/tools/screenshot.ts`.

- [ ] **Step 5: Write save-as-pdf tool**

```typescript
import { registerTool, type ToolExecutor } from "./index.js";

const saveAsPdfTool: ToolExecutor = {
  name: "save_as_pdf",
  async execute(params, ctx) {
    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    const result = await ctx.cdp.send<{ data: string }>("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
    });

    return { success: true, data: result.data };
  },
};

registerTool(saveAsPdfTool);
```

Write to `packages/extension/src/tools/save-as-pdf.ts`.

- [ ] **Step 6: Build to verify all tools compile**

```bash
pnpm --filter @qweb/extension build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(extension): add tool registry, navigate, evaluate, screenshot, save_as_pdf"
```

### Task 4.5: Snapshot Tool

**Files:**
- Create: `packages/extension/src/tools/snapshot.ts`

- [ ] **Step 1: Write snapshot tool**

```typescript
import { registerTool, type ToolExecutor } from "./index.js";
import type { SnapshotElement } from "@qweb/protocol";

interface AXNode {
  nodeId: number;
  backendDOMNodeId: number;
  role?: { value: string };
  name?: { value: string };
  value?: { value: string };
  childIds?: number[];
  properties?: Array<{ name: string; value?: { value: string } }>;
}

interface GetDocumentResult {
  root: AXNode;
}

export const snapshotTool: ToolExecutor = {
  name: "snapshot",
  async execute(_params, ctx) {
    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    const doc = await ctx.cdp.send<GetDocumentResult>("Accessibility.getFullAXTree");

    ctx.refs.clear();
    let refIndex = 0;

    function processNode(node: AXNode): SnapshotElement | null {
      const role = node.role?.value || "";
      // Skip generic/none non-leaf nodes
      if ((role === "none" || role === "generic") && node.childIds?.length) {
        const children: SnapshotElement[] = [];
        // Need to fetch children from node map
        return null;
      }

      const ref = `e${refIndex++}`;
      ctx.refs.set(ref, node.backendDOMNodeId);

      return {
        role,
        name: node.name?.value,
        value: node.value?.value,
        ref: `@${ref}`,
        children: [],
      };
    }

    // Build node map from flat array
    const nodeMap = new Map<number, AXNode>();
    const collectNodes = (node: AXNode) => {
      nodeMap.set(node.nodeId, node);
      // The full tree is the root node
    };
    collectNodes(doc.root);

    function buildTree(node: AXNode): SnapshotElement | null {
      const element = processNode(node);
      if (!element) {
        // For generic/none nodes, flatten children
        if (node.childIds) {
          const results: SnapshotElement[] = [];
          for (const childId of node.childIds) {
            const child = nodeMap.get(childId);
            if (child) {
              const result = buildTree(child);
              if (result) results.push(result);
            }
          }
          return results.length === 1 ? results[0] : results.length > 0 ? { role: "group", ref: `@e${refIndex++}`, children: results } : null;
        }
        return null;
      }

      if (node.childIds) {
        for (const childId of node.childIds) {
          const child = nodeMap.get(childId);
          if (child) {
            const childElement = buildTree(child);
            if (childElement) {
              element.children!.push(childElement);
            }
          }
        }
      }

      return element;
    }

    const results = buildTree(doc.root);
    return results ? [results] : [];
  },
};

registerTool(snapshotTool);
```

Write to `packages/extension/src/tools/snapshot.ts`.

- [ ] **Step 2: Build to verify**

```bash
pnpm --filter @qweb/extension build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(extension): add snapshot tool with a11y tree parsing"
```

### Task 4.6: Click, Fill, Mouse Click Tools

**Files:**
- Create: `packages/extension/src/tools/click.ts`
- Create: `packages/extension/src/tools/mouse-click.ts`

- [ ] **Step 1: Write fill helper and click tool**

```typescript
import { registerTool, type ToolExecutor } from "./index.js";

const clickTool: ToolExecutor = {
  name: "click",
  async execute(params, ctx) {
    const selector = params.selector as string;
    if (!selector) throw new Error("click: selector is required");

    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    if (ctx.refs.isRef(selector)) {
      return clickByRef(selector, ctx);
    }
    return clickBySelector(selector, ctx);
  },
};

async function clickByRef(ref: string, ctx: ToolExecutor["execute"] extends (p: infer P, c: infer C) => unknown ? C : never): Promise<unknown> {
  const refName = ref.startsWith("@") ? ref.slice(1) : ref;
  const entry = ctx.refs.get(refName);
  if (!entry) throw new Error(`click: unknown ref "${ref}". Run snapshot first to get refs.`);

  const { object } = await ctx.cdp.send<{ object: { objectId: string } }>("DOM.resolveNode", {
    backendNodeId: entry.backendDOMNodeId,
  });

  if (!object?.objectId) throw new Error(`click: could not resolve ref "${ref}" to DOM element`);

  const result = await ctx.cdp.send<{ result: { value: unknown }; exceptionDetails?: { text: string } }>(
    "Runtime.callFunctionOn",
    {
      objectId: object.objectId,
      functionDeclaration: `function() {
        this.scrollIntoView({ block: 'center' });
        this.click();
        return { success: true, tag: this.tagName, text: (this.textContent || '').slice(0, 100) };
      }`,
      returnByValue: true,
    }
  );

  if (result.exceptionDetails) throw new Error(`click: ${result.exceptionDetails.text}`);
  return result.result.value || { success: true };
}

async function clickBySelector(selector: string, ctx: ToolExecutor["execute"] extends (p: infer P, c: infer C) => unknown ? C : never): Promise<unknown> {
  const result = await ctx.cdp.send<{ result: { value: unknown }; exceptionDetails?: { text: string } }>(
    "Runtime.evaluate",
    {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { error: 'element not found: ${selector}' };
        el.scrollIntoView({ block: 'center' });
        el.click();
        return { success: true, tag: el.tagName, text: (el.textContent || '').slice(0, 100) };
      })()`,
      returnByValue: true,
    }
  );

  if (result.exceptionDetails) throw new Error(`click: ${result.exceptionDetails.text}`);
  const value = result.result.value as { error?: string; success?: boolean; tag?: string; text?: string };
  if (value?.error) throw new Error(value.error);
  return value || { success: true };
}

registerTool(clickTool);
```

Write to `packages/extension/src/tools/click.ts`.

- [ ] **Step 2: Write mouse-click tool**

```typescript
import { registerTool, type ToolExecutor } from "./index.js";

const mouseClickTool: ToolExecutor = {
  name: "mouse_click",
  async execute(params, ctx) {
    const selector = params.selector as string;
    if (!selector) throw new Error("mouse_click: selector is required");

    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    const isRef = ctx.refs.isRef(selector);
    let objectId: string;

    if (isRef) {
      const refName = selector.startsWith("@") ? selector.slice(1) : selector;
      const entry = ctx.refs.get(refName);
      if (!entry) throw new Error(`mouse_click: unknown ref "${selector}"`);
      const { object } = await ctx.cdp.send<{ object: { objectId: string } }>("DOM.resolveNode", {
        backendNodeId: entry.backendDOMNodeId,
      });
      if (!object?.objectId) throw new Error(`mouse_click: could not resolve ref`);
      objectId = object.objectId;
    } else {
      const result = await ctx.cdp.send<{ result: { objectId?: string; subtype?: string } }>(
        "Runtime.evaluate",
        { expression: `document.querySelector(${JSON.stringify(selector)})`, returnByValue: false }
      );
      if (result.result.subtype === "null" || !result.result.objectId) {
        throw new Error(`mouse_click: element not found: ${selector}`);
      }
      objectId = result.result.objectId;
    }

    // Scroll into view
    await ctx.cdp.send("Runtime.callFunctionOn", {
      objectId,
      functionDeclaration: `function() { this.scrollIntoView({ block: 'center', inline: 'center' }); }`,
    });

    // Get box model
    const boxModel = await ctx.cdp.send<{ model?: { content: number[] } }>("DOM.getBoxModel", { objectId });
    if (!boxModel.model || !boxModel.model.content || boxModel.model.content.length < 8) {
      throw new Error("mouse_click: element has no layout box");
    }
    const [x0, y0, x1, y1, x2, y2, x3, y3] = boxModel.model.content;
    const cx = Math.round((x0 + x1 + x2 + x3) / 4);
    const cy = Math.round((y0 + y1 + y2 + y3) / 4);

    // Dispatch mouse events
    await ctx.cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: cx, y: cy, button: "none", buttons: 0 });
    await ctx.cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", buttons: 1, clickCount: 1 });
    await ctx.cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy, button: "left", buttons: 0, clickCount: 1 });

    const info = await ctx.cdp.send<{ result: { value: { tag: string; text: string } } }>("Runtime.callFunctionOn", {
      objectId,
      functionDeclaration: `function() { return { tag: this.tagName, text: (this.textContent || '').slice(0, 100) }; }`,
      returnByValue: true,
    });

    return {
      success: true,
      x: cx,
      y: cy,
      tag: info.result.value?.tag ?? "",
      text: info.result.value?.text ?? "",
    };
  },
};

registerTool(mouseClickTool);
```

Write to `packages/extension/src/tools/mouse-click.ts`.

- [ ] **Step 3: Write fill tool**

```typescript
import { registerTool, type ToolExecutor } from "./index.js";

function fillFunctionScript(targetExpr: string, value: string): string {
  const n = JSON.stringify(value);
  return `
    const __target = ${targetExpr};
    __target.focus();
    if (__target.isContentEditable) {
      const __sel = window.getSelection();
      if (__sel) {
        const __range = document.createRange();
        __range.selectNodeContents(__target);
        __sel.removeAllRanges();
        __sel.addRange(__range);
      }
      let __inserted = false;
      try {
        __inserted = document.execCommand('insertText', false, ${n});
      } catch (_e) {
        __inserted = false;
      }
      if (!__inserted) {
        __target.textContent = ${n};
        __target.dispatchEvent(new InputEvent('input', {
          inputType: 'insertText',
          data: ${n},
          bubbles: true,
        }));
      }
      return { success: true, tag: __target.tagName, mode: 'contenteditable' };
    }
    const __nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;
    if (__nativeSetter) {
      __nativeSetter.call(__target, ${n});
    } else {
      __target.value = ${n};
    }
    __target.dispatchEvent(new Event('input', { bubbles: true }));
    __target.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true, tag: __target.tagName, mode: 'value' };
  `;
}

const fillTool: ToolExecutor = {
  name: "fill",
  async execute(params, ctx) {
    const selector = params.selector as string;
    const value = params.value as string;
    if (!selector) throw new Error("fill: selector is required");
    if (value == null) throw new Error("fill: value is required");

    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    if (ctx.refs.isRef(selector)) {
      const refName = selector.startsWith("@") ? selector.slice(1) : selector;
      const entry = ctx.refs.get(refName);
      if (!entry) throw new Error(`fill: unknown ref "${selector}"`);

      const { object } = await ctx.cdp.send<{ object: { objectId: string } }>("DOM.resolveNode", {
        backendNodeId: entry.backendDOMNodeId,
      });
      if (!object?.objectId) throw new Error(`fill: could not resolve ref`);

      const result = await ctx.cdp.send<{ result: { value: unknown }; exceptionDetails?: { text: string } }>(
        "Runtime.callFunctionOn",
        {
          objectId: object.objectId,
          functionDeclaration: `function() { ${fillFunctionScript("this", value)} }`,
          returnByValue: true,
        }
      );
      if (result.exceptionDetails) throw new Error(`fill: ${result.exceptionDetails.text}`);
      return result.result.value || { success: true };
    } else {
      const result = await ctx.cdp.send<{ result: { value: unknown }; exceptionDetails?: { text: string } }>(
        "Runtime.evaluate",
        {
          expression: `(() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { error: 'element not found: ${selector}' };
            ${fillFunctionScript("el", value)}
          })()`,
          returnByValue: true,
        }
      );
      if (result.exceptionDetails) throw new Error(`fill: ${result.exceptionDetails.text}`);
      const val = result.result.value as { error?: string; success?: boolean; tag?: string; mode?: string };
      if (val?.error) throw new Error(val.error);
      return val || { success: true };
    }
  },
};

registerTool(fillTool);
```

Write to `packages/extension/src/tools/fill.ts`.

- [ ] **Step 4: Build to verify**

```bash
pnpm --filter @qweb/extension build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(extension): add click, mouse_click, and fill tools"
```

### Task 4.7: Keyboard, Upload, Network, Tab Tools

**Files:**
- Create: `packages/extension/src/tools/key-type.ts`
- Create: `packages/extension/src/tools/send-keys.ts`
- Create: `packages/extension/src/tools/upload.ts`
- Create: `packages/extension/src/tools/network.ts`
- Create: `packages/extension/src/tools/tabs.ts`

- [ ] **Step 1: Write key-type.ts**

```typescript
import { registerTool, type ToolExecutor } from "./index.js";

registerTool({
  name: "key_type",
  async execute(params, ctx) {
    const text = params.text as string;
    if (typeof text !== "string") throw new Error("key_type: text is required");

    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    for (const char of text) {
      await ctx.cdp.send("Input.dispatchKeyEvent", {
        type: "char",
        text: char,
        unmodifiedText: char,
        key: char,
      });
    }

    return { success: true };
  },
});
```

Write to `packages/extension/src/tools/key-type.ts`.

- [ ] **Step 2: Write send-keys.ts**

```typescript
import { registerTool, type ToolExecutor } from "./index.js";

const KEY_MAP: Record<string, { code: string; key: string; text?: string }> = {
  Enter: { code: "Enter", key: "Enter", text: "\r" },
  Tab: { code: "Tab", key: "Tab", text: "\t" },
  Escape: { code: "Escape", key: "Escape" },
  Backspace: { code: "Backspace", key: "Backspace" },
  Delete: { code: "Delete", key: "Delete" },
  ArrowUp: { code: "ArrowUp", key: "ArrowUp" },
  ArrowDown: { code: "ArrowDown", key: "ArrowDown" },
  ArrowLeft: { code: "ArrowLeft", key: "ArrowLeft" },
  ArrowRight: { code: "ArrowRight", key: "ArrowRight" },
  PageUp: { code: "PageUp", key: "PageUp" },
  PageDown: { code: "PageDown", key: "PageDown" },
  Home: { code: "Home", key: "Home" },
  End: { code: "End", key: "End" },
  Space: { code: "Space", key: " ", text: " " },
};

registerTool({
  name: "send_keys",
  async execute(params, ctx) {
    const keys = params.keys as string;
    if (typeof keys !== "string" || !keys.trim()) throw new Error("send_keys: keys is required");

    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    // Parse modifiers and key
    const parts = keys.split("+");
    const keyName = parts[parts.length - 1];
    const modifiers = parts.length > 1 ? parts.slice(0, -1).reduce((mod, m) => {
      if (m === "Control" || m === "Ctrl") mod += 2;
      if (m === "Alt") mod += 1;
      if (m === "Shift") mod += 8;
      if (m === "Meta" || m === "Command") mod += 4;
      return mod;
    }, 0) : 0;

    const keyDef = KEY_MAP[keyName] || { code: keyName, key: keyName.toLowerCase(), text: keyName.toLowerCase() };

    await ctx.cdp.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: keyDef.key,
      code: keyDef.code,
      text: keyDef.text,
      modifiers,
    });
    await ctx.cdp.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: keyDef.key,
      code: keyDef.code,
      modifiers,
    });

    return { success: true };
  },
});
```

Write to `packages/extension/src/tools/send-keys.ts`.

- [ ] **Step 3: Write upload.ts**

```typescript
import { registerTool, type ToolExecutor } from "./index.js";

registerTool({
  name: "upload",
  async execute(params, ctx) {
    const selector = params.selector as string;
    const filePath = params.filePath as string | undefined;
    const files = params.files as string[] | undefined;

    if (!selector) throw new Error("upload: selector is required");
    const paths = files ?? (filePath ? [filePath] : []);
    if (paths.length === 0) throw new Error("upload: filePath or files is required");

    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    let objectId: string;

    if (ctx.refs.isRef(selector)) {
      const refName = selector.startsWith("@") ? selector.slice(1) : selector;
      const entry = ctx.refs.get(refName);
      if (!entry) throw new Error(`upload: unknown ref "${selector}"`);
      const { object } = await ctx.cdp.send<{ object: { objectId: string } }>("DOM.resolveNode", {
        backendNodeId: entry.backendDOMNodeId,
      });
      if (!object?.objectId) throw new Error("upload: could not resolve ref");
      objectId = object.objectId;
    } else {
      const result = await ctx.cdp.send<{ result: { objectId?: string; subtype?: string } }>(
        "Runtime.evaluate",
        { expression: `document.querySelector(${JSON.stringify(selector)})`, returnByValue: false }
      );
      if (result.result.subtype === "null" || !result.result.objectId) {
        throw new Error(`upload: element not found: ${selector}`);
      }
      objectId = result.result.objectId;
    }

    const nodeId = await ctx.cdp.send<{ nodeId: number }>("DOM.requestNode", { objectId });
    await ctx.cdp.send("DOM.setFileInputFiles", {
      nodeId: nodeId.nodeId,
      files: paths,
    });

    return { success: true };
  },
});
```

Write to `packages/extension/src/tools/upload.ts`.

- [ ] **Step 4: Write network.ts**

```typescript
import { registerTool, type ToolExecutor } from "./index.js";

interface StoredRequest {
  requestId: string;
  url: string;
  method: string;
  status?: number;
  type: string;
  timestamp: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
}

const requests = new Map<string, StoredRequest>();
let networkEnabled = false;

const cdpNetwork: ToolExecutor = {
  name: "network",
  async execute(params, ctx) {
    const cmd = params.cmd as string;
    if (!cmd) throw new Error("network: cmd is required");

    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    switch (cmd) {
      case "start": {
        networkEnabled = true;
        requests.clear();
        await ctx.cdp.send("Network.enable");
        // Listen for network events via CDP
        chrome.debugger.onEvent.addListener((source, method, eventParams) => {
          if (source.tabId !== ctx.cdp.getCurrentTabId()) return;

          if (method === "Network.requestWillBeSent") {
            const p = eventParams as {
              requestId: string;
              request: { url: string; method: string; headers: Record<string, string> };
              type: string;
              timestamp: number;
            };
            requests.set(p.requestId, {
              requestId: p.requestId,
              url: p.request.url,
              method: p.request.method,
              type: p.type,
              timestamp: p.timestamp,
              requestHeaders: p.request.headers,
            });
          } else if (method === "Network.responseReceived") {
            const p = eventParams as {
              requestId: string;
              response: { status: number; headers: Record<string, string> };
            };
            const req = requests.get(p.requestId);
            if (req) {
              req.status = p.response.status;
              req.responseHeaders = p.response.headers;
            }
          } else if (method === "Network.loadingFinished") {
            // Mark as complete
          }
        });
        return { success: true };
      }

      case "stop": {
        networkEnabled = false;
        await ctx.cdp.send("Network.disable");
        return { success: true };
      }

      case "list": {
        const filterStr = params.filter as string | undefined;
        let list = Array.from(requests.values());
        if (filterStr) {
          const filter = new RegExp(filterStr, "i");
          list = list.filter((r) => filter.test(r.url));
        }
        return { requests: list };
      }

      case "detail": {
        const requestId = params.requestId as string | undefined;
        if (!requestId) throw new Error("network detail: requestId is required");
        const req = requests.get(requestId);
        if (!req) throw new Error(`network: request ${requestId} not found`);

        // Try to get response body
        try {
          const bodyResult = await ctx.cdp.send<{ body: string; base64Encoded: boolean }>(
            "Network.getResponseBody",
            { requestId }
          );
          req.responseBody = bodyResult.base64Encoded
            ? Buffer.from(bodyResult.body, "base64").toString("utf-8")
            : bodyResult.body;
        } catch {
          // Body may not be available
        }

        return { request: req };
      }

      default:
        throw new Error(`network: unknown cmd "${cmd}"`);
    }
  },
};

registerTool(cdpNetwork);
```

Write to `packages/extension/src/tools/network.ts`.

- [ ] **Step 5: Write tabs.ts (find_tab, list_tabs, close_tab, close_session)**

```typescript
import { registerTool, type ToolExecutor } from "./index.js";
import { untrackTab, clearSessionGroup } from "../tab-manager.js";

registerTool({
  name: "find_tab",
  async execute(params) {
    const url = params.url as string;
    if (!url) throw new Error("find_tab: url is required");

    const allTabs = await chrome.tabs.query({});
    for (const tab of allTabs) {
      if (tab.url?.includes(url)) {
        return { tabId: tab.id!, url: tab.url, title: tab.title || "" };
      }
    }
    throw new Error(`find_tab: no tab found matching "${url}"`);
  },
});

registerTool({
  name: "list_tabs",
  async execute(params) {
    const tabIds = params._tabIds as number[] | undefined;
    if (Array.isArray(tabIds) && tabIds.length > 0) {
      const tabs = await Promise.all(tabIds.map((id) => chrome.tabs.get(id).catch(() => null)));
      return {
        tabs: tabs.filter(Boolean).map((t) => ({
          tabId: t!.id!,
          url: t!.url || "",
          title: t!.title || "",
          active: t!.active,
        })),
      };
    }
    const allTabs = await chrome.tabs.query({});
    return {
      tabs: allTabs.map((t) => ({
        tabId: t.id!,
        url: t.url || "",
        title: t.title || "",
        active: t.active,
      })),
    };
  },
});

registerTool({
  name: "close_tab",
  async execute(params, ctx) {
    const tabId = params._tabId as number | undefined;
    if (tabId == null) return { success: true };

    try {
      await ctx.cdp.detach(tabId);
    } catch {}
    untrackTab(tabId);
    await chrome.tabs.remove(tabId);
    return { success: true };
  },
});

registerTool({
  name: "close_session",
  async execute(params, ctx) {
    const tabIds = params._tabIds as number[] | undefined;
    const sessionName = params._session as string | undefined;

    if (Array.isArray(tabIds)) {
      for (const tabId of tabIds) {
        try {
          await ctx.cdp.detach(tabId);
        } catch {}
        untrackTab(tabId);
        await chrome.tabs.remove(tabId).catch(() => {});
      }
    }
    if (sessionName) {
      clearSessionGroup(sessionName);
    }
    return { success: true };
  },
});
```

Write to `packages/extension/src/tools/tabs.ts`.

- [ ] **Step 6: Build to verify**

```bash
pnpm --filter @qweb/extension build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(extension): add key_type, send_keys, upload, network, and tab tools"
```

### Task 4.8: Background Service Worker (wire everything together)

**Files:**
- Modify: `packages/extension/src/background.ts`

- [ ] **Step 1: Write complete background.ts**

```typescript
import { CDPController } from "./cdp/controller.js";
import { RefStore } from "./ref-store.js";
import { getTool } from "./tools/index.js";
import type { Message, CommandRequest } from "@qweb/protocol";

// Import all tool registrations
import "./tools/navigate.js";
import "./tools/snapshot.js";
import "./tools/screenshot.js";
import "./tools/click.js";
import "./tools/mouse-click.js";
import "./tools/fill.js";
import "./tools/evaluate.js";
import "./tools/key-type.js";
import "./tools/send-keys.js";
import "./tools/upload.js";
import "./tools/network.js";
import "./tools/tabs.js";
import "./tools/save-as-pdf.js";

const cdp = new CDPController();
const refs = new RefStore();
const DAEMON_PORT = 10086;
const WS_URL = `ws://127.0.0.1:${DAEMON_PORT}/selector/command`;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let handshakeDone = false;

function connect(): void {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log("[QwebBridge] Connected to daemon");
      ws!.send(JSON.stringify({
        id: "extension-hello",
        type: "hello",
        payload: { agent: "extension", version: "1.0.0" },
      }));
    };

    ws.onmessage = async (event: MessageEvent) => {
      try {
        const msg: Message = JSON.parse(event.data as string);

        if (msg.type === "response" && !handshakeDone) {
          handshakeDone = true;
          console.log("[QwebBridge] Handshake complete");
          return;
        }

        if (msg.type !== "command" || !handshakeDone) return;

        const cmd = msg.payload as CommandRequest;
        const tool = getTool(cmd.tool);

        if (!tool) {
          ws!.send(JSON.stringify({
            id: msg.id,
            type: "error",
            payload: { code: "tool_not_found", message: `Unknown tool: ${cmd.tool}` },
          }));
          return;
        }

        try {
          const result = await tool.execute(cmd.params, { cdp, refs });
          ws!.send(JSON.stringify({
            id: msg.id,
            type: "response",
            payload: { result },
          }));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          ws!.send(JSON.stringify({
            id: msg.id,
            type: "error",
            payload: { code: "execution_error", message },
          }));
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      console.log("[QwebBridge] Disconnected from daemon, reconnecting...");
      handshakeDone = false;
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, 2000);
}

// Keep service worker alive
chrome.alarms.create("keepalive", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepalive" && (!ws || ws.readyState !== WebSocket.OPEN)) {
    connect();
  }
});

// Initial connection
connect();

// Handle tab removal cleanup
chrome.tabs.onRemoved.addListener((tabId) => {
  try {
    cdp.detach(tabId);
  } catch {}
});

chrome.debugger.onDetach.addListener(({ tabId }) => {
  if (tabId) {
    try {
      cdp.detach(tabId);
    } catch {}
  }
});

console.log("[QwebBridge] Service worker started");
```

Write to `packages/extension/src/background.ts`.

- [ ] **Step 2: Build**

```bash
pnpm --filter @qweb/extension build
```

Expected: Build succeeds, output in packages/extension/dist/.

- [ ] **Step 3: Verify dist contains all required files**

```bash
ls packages/extension/dist/
```

Expected: `background.js` exists.

- [ ] **Step 4: Copy static files to dist**

Update `vite.config.ts` to copy static files. Add the following to the build config:

Edit `packages/extension/vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, existsSync, mkdirSync } from "fs";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        format: "iife",
      },
    },
  },
  plugins: [
    {
      name: "copy-static",
      closeBundle() {
        const staticDir = resolve(__dirname, "static");
        const distDir = resolve(__dirname, "dist");
        if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

        // Copy manifest
        copyFileSync(
          resolve(staticDir, "manifest.json"),
          resolve(distDir, "manifest.json")
        );
        // Copy popup
        copyFileSync(
          resolve(staticDir, "popup.html"),
          resolve(distDir, "popup.html")
        );
      },
    },
  ],
  resolve: {
    // Allow importing @qweb/protocol in browser context
    conditions: ["browser"],
  },
});
```

- [ ] **Step 5: Rebuild with static copy**

```bash
pnpm --filter @qweb/extension build
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(extension): wire background service worker with daemon connection"
```

### Task 4.9: Popup script and MCP adapter

**Files:**
- Create: `packages/extension/static/popup.js`
- Create: `packages/daemon/src/adapters/mcp.ts`
- Modify: `packages/extension/vite.config.ts` (add popup.js to build)

- [ ] **Step 1: Write popup.js**

```javascript
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

function updateStatus(connected) {
  if (connected) {
    statusDot.className = "dot connected";
    statusText.textContent = "Connected";
  } else {
    statusDot.className = "dot disconnected";
    statusText.textContent = "Disconnected";
  }
}

// Check connection status
try {
  chrome.runtime.sendMessage({ type: "status" }, (response) => {
    if (chrome.runtime.lastError) {
      updateStatus(false);
    } else {
      updateStatus(response?.connected ?? false);
    }
  });
} catch {
  updateStatus(false);
}
```

Write to `packages/extension/static/popup.js`.

- [ ] **Step 2: Update vite.config.ts to include popup.js in build**

Edit `packages/extension/vite.config.ts`, change the `rollupOptions.input`:
```typescript
input: {
  background: resolve(__dirname, "src/background.ts"),
  popup: resolve(__dirname, "static/popup.js"),
},
```

And add `popup.html` copy (already handled in closeBundle plugin).

- [ ] **Step 3: Write MCP adapter skeleton**

```typescript
/**
 * MCP (Model Context Protocol) Adapter
 *
 * Implements MCP server over stdio, exposing all 16 tools
 * as MCP tools with "browser_" prefix.
 *
 * MCP protocol spec: https://spec.modelcontextprotocol.io/
 *
 * This is a minimal skeleton. A full MCP implementation requires:
 * - stdio message framing (newline-delimited JSON)
 * - tools/list handler
 * - tools/call handler
 * - JSON-RPC 2.0 compliance
 */

import type { SessionManager } from "../session.js";
import { TOOL_NAMES } from "@qweb/protocol";

interface MCPRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

export function createMCPAdapter(sessionManager: SessionManager): void {
  const tools = TOOL_NAMES.map((name) => ({
    name: `browser_${name}`,
    description: `Browser tool: ${name}`,
    inputSchema: {
      type: "object",
      properties: {
        params: { type: "object", description: `Params for ${name} tool` },
        session: { type: "string", description: "Browser session name" },
      },
    },
  }));

  let buffer = "";

  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk: string) => {
    buffer += chunk;

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const req: MCPRequest = JSON.parse(line);

        switch (req.method) {
          case "initialize": {
            const res: MCPResponse = {
              jsonrpc: "2.0",
              id: req.id,
              result: {
                protocolVersion: "2024-11-05",
                capabilities: { tools: {} },
                serverInfo: { name: "qweb-bridge", version: "1.0.0" },
              },
            };
            process.stdout.write(JSON.stringify(res) + "\n");
            break;
          }

          case "tools/list": {
            const res: MCPResponse = {
              jsonrpc: "2.0",
              id: req.id,
              result: { tools },
            };
            process.stdout.write(JSON.stringify(res) + "\n");
            break;
          }

          case "tools/call": {
            const params = req.params as { name: string; arguments?: Record<string, unknown> };
            const toolName = params.name.replace(/^browser_/, "");

            if (!(TOOL_NAMES as readonly string[]).includes(toolName)) {
              const res: MCPResponse = {
                jsonrpc: "2.0",
                id: req.id,
                error: { code: -32601, message: `Unknown tool: ${params.name}` },
              };
              process.stdout.write(JSON.stringify(res) + "\n");
              break;
            }

            const msg = {
              id: `mcp-${req.id}`,
              type: "command",
              payload: {
                tool: toolName,
                params: params.arguments ?? {},
                session: params.arguments?.session as string | undefined,
              },
            };

            sessionManager.sendToExtension(msg)
              .then((result) => {
                const res: MCPResponse = {
                  jsonrpc: "2.0",
                  id: req.id,
                  result: { content: [{ type: "text", text: JSON.stringify(result) }] },
                };
                process.stdout.write(JSON.stringify(res) + "\n");
              })
              .catch((err: Error) => {
                const res: MCPResponse = {
                  jsonrpc: "2.0",
                  id: req.id,
                  result: {
                    content: [{ type: "text", text: `Error: ${err.message}` }],
                    isError: true,
                  },
                };
                process.stdout.write(JSON.stringify(res) + "\n");
              });
            break;
          }

          default: {
            const res: MCPResponse = {
              jsonrpc: "2.0",
              id: req.id,
              error: { code: -32601, message: `Method not found: ${req.method}` },
            };
            process.stdout.write(JSON.stringify(res) + "\n");
          }
        }
      } catch {
        const res: MCPResponse = {
          jsonrpc: "2.0",
          id: "unknown",
          error: { code: -32700, message: "Parse error" },
        };
        process.stdout.write(JSON.stringify(res) + "\n");
      }
    }
  });
}
```

Write to `packages/daemon/src/adapters/mcp.ts`.

- [ ] **Step 4: Add MCP command to CLI**

Edit `packages/daemon/src/cli/cli.ts`, add case before default:
```typescript
case "mcp": {
  const sm = new SessionManager();
  const { httpServer } = await createServer(sm);
  writePid(process.pid);

  const { createMCPAdapter } = await import("../adapters/mcp.js");
  createMCPAdapter(sm);

  process.on("SIGINT", () => { httpServer.close(); process.exit(0); });
  process.on("SIGTERM", () => { httpServer.close(); process.exit(0); });
  break;
}
```

- [ ] **Step 5: Build to verify**

```bash
pnpm --filter @qweb/daemon build && pnpm --filter @qweb/extension build
```

Expected: Both packages build successfully.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add popup script and MCP adapter"
```

---

## Stage 5: Integration Testing

### Task 5.1: Daemon to Extension integration test

**Files:**
- Create: `packages/daemon/src/__tests__/integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import { createServer } from "../server.js";
import { SessionManager } from "../session.js";
import type { Server } from "http";

const TEST_PORT = 10088;
const WS_URL = `ws://127.0.0.1:${TEST_PORT}/selector/command`;

describe("Daemon Integration", () => {
  let httpServer: Server;
  let sm: SessionManager;

  beforeAll(async () => {
    sm = new SessionManager();
    const result = await createServer(sm, TEST_PORT);
    httpServer = result.httpServer;
  });

  afterAll(() => {
    httpServer.close();
  });

  it("should complete hello → command → response flow with mock extension", async () => {
    // Connect as extension
    const extWs = new WebSocket(WS_URL);
    await new Promise<void>((resolve) => {
      extWs.on("open", () => {
        extWs.send(JSON.stringify({
          id: "ext-1",
          type: "hello",
          payload: { agent: "extension" },
        }));
      });
      extWs.on("message", () => resolve());
    });

    // Connect as agent
    const agentWs = new WebSocket(WS_URL);
    await new Promise<void>((resolve) => {
      agentWs.on("open", () => {
        agentWs.send(JSON.stringify({
          id: "agent-1",
          type: "hello",
          payload: { agent: "test" },
        }));
      });
      agentWs.on("message", () => resolve());
    });

    // Extension should process commands sent by agent
    extWs.on("message", (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "command") {
        extWs.send(JSON.stringify({
          id: msg.id,
          type: "response",
          payload: { result: { success: true, url: "https://example.com", tabId: 42 } },
        }));
      }
    });

    // Agent sends command and receives response
    const response = await new Promise<{ type: string }>((resolve) => {
      agentWs.send(JSON.stringify({
        id: "cmd-1",
        type: "command",
        payload: { tool: "navigate", params: { url: "https://example.com" } },
      }));
      agentWs.on("message", (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === "cmd-1") resolve(msg);
      });
    });

    expect(response.type).toBe("response");

    agentWs.close();
    extWs.close();
  });
});
```

Write to `packages/daemon/src/__tests__/integration.test.ts`.

- [ ] **Step 2: Run integration tests**

```bash
pnpm --filter @qweb/daemon test --run
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test(daemon): add integration test for agent ↔ daemon ↔ extension flow"
```

---

## Stage 6: Final Polish

### Task 6.1: Add README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
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

- **WebSocket**: Connect to `ws://localhost:10086/selector/command`
- **MCP**: Run `qweb-bridge mcp` for Claude Desktop / Cursor
- **HTTP REST**: `POST /api/tool/<name>`
- **CLI**: `qweb-bridge navigate --url https://example.com`

## License

MIT
```

Write to `README.md`.

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "docs: add README with architecture and usage"
```

### Task 6.2: Verify full build chain

- [ ] **Step 1: Run full build**

```bash
pnpm build
```

Expected: All packages build successfully.

- [ ] **Step 2: Run all tests**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: No type errors.

- [ ] **Step 4: Commit final state**

```bash
git status
git add -A
git commit -m "chore: verify full build chain passes"
```
