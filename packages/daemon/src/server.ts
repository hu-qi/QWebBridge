import { WebSocketServer, WebSocket } from "ws";
import { createServer as createHttpServer } from "http";
import { WS_PATH, ERROR_CODES } from "@qweb/protocol";
import { SessionManager } from "./session.js";
import { handleHttpRequest } from "./adapters/http.js";
import { loadConfig } from "./config.js";
import type { Message } from "@qweb/protocol";

export function createServer(sessionManager: SessionManager, port?: number): Promise<{ httpServer: ReturnType<typeof createHttpServer> }> {
  const config = loadConfig();
  const listenPort = port ?? config.port;
  const startTime = Date.now();

  const httpServer = createHttpServer((req, res) => {
    if (handleHttpRequest(req, res, sessionManager, startTime)) return;

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

  const wss = new WebSocketServer({ server: httpServer, path: `/${WS_PATH}` });

  wss.on("connection", (ws: WebSocket) => {
    let isExtension = false;
    let agentId: string | null = null;
    let handshakeDone = false;

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as Message;

        if (!handshakeDone && msg.type === "hello") {
          handshakeDone = true;
          const payload = msg.payload as { agent?: string; version?: string; extension_id?: string };
          const agent = payload.agent || "";

          if (agent === "extension") {
            isExtension = true;
            const extId = (payload as { extension_id?: string }).extension_id;
            sessionManager.setExtension(ws, payload.version, extId);
            ws.send(JSON.stringify({
              id: msg.id,
              type: "hello_ack",
              payload: { status: "connected", extensionVersion: payload.version || "1.0.0" },
            }));
            return;
          }

          agentId = sessionManager.addAgent(ws, agent);
          ws.send(JSON.stringify({
            id: msg.id,
            type: "hello_ack",
            payload: { status: "connected", session_id: agentId },
          }));
          return;
        }

        if (!handshakeDone) {
          ws.send(JSON.stringify({
            id: msg.id || "unknown",
            type: "error",
            payload: { code: ERROR_CODES.PROTOCOL_ERROR, message: "Hello message required before tool calls" },
          }));
          return;
        }

        if (msg.type === "tool_call" && !isExtension) {
          sessionManager.sendToExtension(msg)
            .then((result) => {
              ws.send(JSON.stringify({
                id: msg.id,
                type: "tool_result",
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
