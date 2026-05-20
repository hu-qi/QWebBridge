import { WebSocketServer, WebSocket } from "ws";
import { createServer as createHttpServer } from "http";
import { DAEMON_PORT, WS_PATH } from "@qweb/protocol";
import { SessionManager } from "./session.js";
import { handleHttpRequest } from "./adapters/http.js";
import { loadConfig } from "./config.js";
import type { Message, CommandRequest } from "@qweb/protocol";

export function createServer(sessionManager: SessionManager, port?: number): Promise<{ httpServer: ReturnType<typeof createHttpServer> }> {
  const config = loadConfig();
  const listenPort = port ?? config.port;

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

  const wss = new WebSocketServer({ server: httpServer, path: `/${WS_PATH}` });

  wss.on("connection", (ws: WebSocket, req) => {
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
