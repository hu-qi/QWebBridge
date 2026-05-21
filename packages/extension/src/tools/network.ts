import { registerTool, getTabId, type ToolExecutor } from "./index.js";

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
let networkHandler: ((source: chrome.debugger.Debuggee, method: string, params?: object) => void) | null = null;

const cdpNetwork: ToolExecutor = {
  name: "network",
  async execute(params, ctx) {
    const cmd = params.cmd as string;
    if (!cmd) throw new Error("network: cmd is required");

    await ctx.cdp.attach(await getTabId(params, ctx));

    switch (cmd) {
      case "start": {
        requests.clear();
        await ctx.cdp.send("Network.enable");

        networkHandler = (
          source: chrome.debugger.Debuggee,
          method: string,
          params?: object
        ) => {
          if (source.tabId !== ctx.cdp.getCurrentTabId()) return;

          if (method === "Network.requestWillBeSent") {
            const p = params as unknown as {
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
            const p = params as unknown as {
              requestId: string;
              response: { status: number; headers: Record<string, string> };
            };
            const req = requests.get(p.requestId);
            if (req) {
              req.status = p.response.status;
              req.responseHeaders = p.response.headers;
            }
          }
        };

        chrome.debugger.onEvent.addListener(networkHandler);

        return { success: true };
      }

      case "stop": {
        if (networkHandler) {
          chrome.debugger.onEvent.removeListener(networkHandler);
          networkHandler = null;
        }
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
