import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import { createServer } from "../server.js";
import { SessionManager } from "../session.js";
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

  it("should respond to hello with hello_ack", async () => {
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
        expect(msg.type).toBe("hello_ack");
        expect(msg.payload.status).toBe("connected");
        ws.close();
        resolve();
      });
    });
  });

  it("should require hello before tool calls", async () => {
    const ws = new WebSocket(WS_URL);

    await new Promise<void>((resolve) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({
          id: "2",
          type: "tool_call",
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