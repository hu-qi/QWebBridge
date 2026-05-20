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
