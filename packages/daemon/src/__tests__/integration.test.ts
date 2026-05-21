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

  it("should complete hello -> tool_call -> tool_result flow with mock extension", async () => {
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

    // Extension should process tool calls sent by agent
    extWs.on("message", (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "tool_call") {
        extWs.send(JSON.stringify({
          id: msg.id,
          type: "tool_result",
          payload: { result: { success: true, url: "https://example.com", tabId: 42 } },
        }));
      }
    });

    // Agent sends tool_call and receives tool_result
    const response = await new Promise<{ type: string }>((resolve) => {
      agentWs.send(JSON.stringify({
        id: "cmd-1",
        type: "tool_call",
        payload: { tool: "navigate", params: { url: "https://example.com" } },
      }));
      agentWs.on("message", (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === "cmd-1") resolve(msg);
      });
    });

    expect(response.type).toBe("tool_result");

    agentWs.close();
    extWs.close();
  });
});