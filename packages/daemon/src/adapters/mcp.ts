import type { SessionManager } from "../session.js";
import { TOOL_NAMES, ERROR_CODES } from "@qweb/protocol";

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
              type: "tool_call" as const,
              payload: {
                tool: toolName,
                params: params.arguments ?? {},
                session: params.arguments?.session as string | undefined,
              },
            };

            sessionManager
              .sendToExtension(msg)
              .then((result) => {
                const res: MCPResponse = {
                  jsonrpc: "2.0",
                  id: req.id,
                  result: { content: [{ type: "text", text: JSON.stringify(result) }] },
                };
                process.stdout.write(JSON.stringify(res) + "\n");
              })
              .catch((err: Error) => {
                const code = err.message;
                const res: MCPResponse = {
                  jsonrpc: "2.0",
                  id: req.id,
                  result: {
                    content: [{ type: "text", text: `Error: ${errorMessage(code)}` }],
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
