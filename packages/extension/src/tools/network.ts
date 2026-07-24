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

interface NetworkCapture {
  active: boolean;
  requests: Map<string, StoredRequest>;
}

const captures = new Map<number, NetworkCapture>();
let listenerInstalled = false;

const networkHandler = (source: chrome.debugger.Debuggee, method: string, params?: object): void => {
  if (typeof source.tabId !== "number") return;
  const capture = captures.get(source.tabId);
  if (!capture?.active) return;

  if (method === "Network.requestWillBeSent") {
    const event = params as {
      requestId: string;
      request: { url: string; method: string; headers: Record<string, string> };
      type: string;
      timestamp: number;
    };
    capture.requests.set(event.requestId, {
      requestId: event.requestId,
      url: event.request.url,
      method: event.request.method,
      type: event.type,
      timestamp: event.timestamp,
      requestHeaders: event.request.headers,
    });
    return;
  }

  if (method === "Network.responseReceived") {
    const event = params as {
      requestId: string;
      response: { status: number; headers: Record<string, string> };
    };
    const request = capture.requests.get(event.requestId);
    if (request) {
      request.status = event.response.status;
      request.responseHeaders = event.response.headers;
    }
  }
};

function installNetworkListener(): void {
  if (listenerInstalled) return;
  chrome.debugger.onEvent.addListener(networkHandler);
  listenerInstalled = true;
}

function removeNetworkListenerIfIdle(): void {
  if (!listenerInstalled || Array.from(captures.values()).some((capture) => capture.active)) return;
  chrome.debugger.onEvent.removeListener(networkHandler);
  listenerInstalled = false;
}

export function clearNetworkCapture(tabId: number): void {
  captures.delete(tabId);
  removeNetworkListenerIfIdle();
}

const cdpNetwork: ToolExecutor = {
  name: "network",
  async execute(params, ctx) {
    const cmd = params.cmd as string;
    if (!cmd) throw new Error("network: cmd is required");

    const tabId = await getTabId(params, ctx);
    return ctx.cdp.run(tabId, async (tab) => {
      switch (cmd) {
        case "start": {
          const previousCapture = captures.get(tabId);
          captures.set(tabId, { active: true, requests: new Map() });
          installNetworkListener();
          try {
            await tab.send("Network.enable");
          } catch (error) {
            if (previousCapture) {
              captures.set(tabId, previousCapture);
            } else {
              captures.delete(tabId);
            }
            removeNetworkListenerIfIdle();
            throw error;
          }
          return { success: true };
        }

        case "stop": {
          const capture = captures.get(tabId);
          if (capture) capture.active = false;
          removeNetworkListenerIfIdle();
          await tab.send("Network.disable");
          return { success: true };
        }

        case "list": {
          const filterText = params.filter as string | undefined;
          let requests = Array.from(captures.get(tabId)?.requests.values() ?? []);
          if (filterText) {
            const filter = new RegExp(filterText, "i");
            requests = requests.filter((request) => filter.test(request.url));
          }
          return { requests };
        }

        case "detail": {
          const requestId = params.requestId as string | undefined;
          if (!requestId) throw new Error("network detail: requestId is required");
          const request = captures.get(tabId)?.requests.get(requestId);
          if (!request) throw new Error(`network: request ${requestId} not found`);

          try {
            const bodyResult = await tab.send<{ body: string; base64Encoded: boolean }>("Network.getResponseBody", {
              requestId,
            });
            request.responseBody = bodyResult.base64Encoded
              ? Buffer.from(bodyResult.body, "base64").toString("utf-8")
              : bodyResult.body;
          } catch {
            // Chrome can discard response bodies before this call.
          }

          return { request };
        }

        default:
          throw new Error(`network: unknown cmd "${cmd}"`);
      }
    });
  },
};

registerTool(cdpNetwork);
