import type { IncomingMessage, ServerResponse } from "http";
import type { SessionManager } from "../session.js";
import { TOOL_NAMES, DAEMON_PORT, ERROR_CODES } from "@qweb/protocol";

type ToolName = (typeof TOOL_NAMES)[number];

function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

function errorMessage(code: string): string {
  if (code === ERROR_CODES.NO_EXTENSION_CONNECTED) {
    return "Chrome extension is not connected. Please ensure the QwebBridge extension is installed and enabled.";
  }
  if (code === ERROR_CODES.EXTENSION_DISCONNECTED) {
    return "Chrome extension disconnected before the request completed.";
  }
  if (code === ERROR_CODES.REQUEST_TIMEOUT) {
    return "Timed out waiting for Chrome extension response.";
  }
  return code;
}

interface BatchToolRequest {
  tool: string;
  params?: Record<string, unknown>;
}

export function handleHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessionManager: SessionManager,
  startTime?: number,
): boolean {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  // Health check
  if (url.pathname === "/health" && req.method === "GET") {
    const uptime = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        running: true,
        port: DAEMON_PORT,
        version: "1.0.1",
        uptime_seconds: uptime,
        extensions_connected: sessionManager.hasExtension(),
        extension_version: sessionManager.getExtensionVersion(),
        extension_id: sessionManager.getExtensionId() || "",
      }),
    );
    return true;
  }

  // Batch Tool API: POST /api/batch
  if (url.pathname === "/api/batch" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const params = body ? (JSON.parse(body) as { requests?: BatchToolRequest[] }) : {};
        const requests = params.requests;
        if (!Array.isArray(requests) || requests.length === 0) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ success: false, error: "invalid_params", message: "requests must be a non-empty array" }),
          );
          return;
        }

        const invalid = requests.find((request) => !request || !isToolName(request.tool));
        if (invalid) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: false,
              error: "unknown_tool",
              message: `Unknown tool: ${invalid?.tool}`,
              available_tools: TOOL_NAMES,
            }),
          );
          return;
        }

        const results = await Promise.all(
          requests.map(async (request, index) => {
            const id = `http-batch-${Date.now()}-${index}`;
            const commandMsg = {
              id,
              type: "tool_call" as const,
              payload: { tool: request.tool, params: request.params ?? {} },
            };

            try {
              const result = await sessionManager.sendToExtension(commandMsg);
              return { index, tool: request.tool, success: true, result };
            } catch (err) {
              const code = err instanceof Error ? err.message : "unknown_error";
              return { index, tool: request.tool, success: false, error: code, message: errorMessage(code) };
            }
          }),
        );

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, results }));
      } catch (err) {
        const code = err instanceof Error ? err.message : "unknown_error";
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: code, message: errorMessage(code) }));
      }
    });
    return true;
  }

  // Tool API: POST /api/tool/:name
  const toolMatch = url.pathname.match(/^\/api\/tool\/(\w+)$/);
  if (toolMatch && req.method === "POST") {
    const toolName = toolMatch[1];
    if (!isToolName(toolName)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "unknown_tool", message: `Unknown tool: ${toolName}`, available_tools: TOOL_NAMES }),
      );
      return true;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const params = body ? JSON.parse(body) : {};
        const id = `http-${Date.now()}`;
        const commandMsg = {
          id,
          type: "tool_call" as const,
          payload: { tool: toolName, params },
        };

        const result = await sessionManager.sendToExtension(commandMsg);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, result }));
      } catch (err) {
        const code = err instanceof Error ? err.message : "unknown_error";
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: code, message: errorMessage(code) }));
      }
    });
    return true;
  }

  return false;
}
