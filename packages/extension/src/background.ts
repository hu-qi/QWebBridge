import { CDPController } from "./cdp/controller.js";
import { RefStore } from "./ref-store.js";
import { getTool } from "./tools/index.js";
import { ERROR_CODES } from "@qweb/protocol";
import type { Message, ToolCallPayload } from "@qweb/protocol";

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

        if (msg.type === "hello_ack" && !handshakeDone) {
          handshakeDone = true;
          console.log("[QwebBridge] Handshake complete");
          return;
        }

        if (msg.type !== "tool_call" || !handshakeDone) return;

        const cmd = msg.payload as ToolCallPayload;
        const tool = getTool(cmd.tool);

        if (!tool) {
          ws!.send(JSON.stringify({
            id: msg.id,
            type: "error",
            payload: { code: ERROR_CODES.TOOL_NOT_FOUND, message: `Unknown tool: ${cmd.tool}` },
          }));
          return;
        }

        try {
          const result = await tool.execute(cmd.params, { cdp, refs });
          ws!.send(JSON.stringify({
            id: msg.id,
            type: "tool_result",
            payload: { result },
          }));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          ws!.send(JSON.stringify({
            id: msg.id,
            type: "error",
            payload: { code: ERROR_CODES.EXECUTION_ERROR, message },
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