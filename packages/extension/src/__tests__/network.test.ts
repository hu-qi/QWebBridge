import { expect, it, vi } from "vitest";
import { getTool, type ToolContext } from "../tools/index.js";
import { RefStore } from "../ref-store.js";
import "../tools/network.js";

type DebuggerListener = (source: chrome.debugger.Debuggee, method: string, params?: object) => void;

const listeners = new Set<DebuggerListener>();
const addListener = vi.fn((listener: DebuggerListener) => listeners.add(listener));
const removeListener = vi.fn((listener: DebuggerListener) => listeners.delete(listener));

(globalThis as Record<string, unknown>).chrome = {
  debugger: {
    onEvent: {
      addListener,
      removeListener,
    },
  },
};

function emit(tabId: number, method: string, params: object): void {
  for (const listener of listeners) {
    listener({ tabId }, method, params);
  }
}

function createContext(): ToolContext {
  const cdp = {
    async run<T>(
      tabId: number,
      operation: (tab: {
        tabId: number;
        send<R>(method: string, params?: Record<string, unknown>): Promise<R>;
      }) => Promise<T>,
    ): Promise<T> {
      return operation({
        tabId,
        async send<R>(): Promise<R> {
          return {} as R;
        },
      });
    },
  };
  return { cdp, refs: new RefStore() } as unknown as ToolContext;
}

it("keeps network captures isolated by tab", async () => {
  const ctx = createContext();
  const network = getTool("network")!;

  await network.execute({ cmd: "start", tabId: 1 }, ctx);
  await network.execute({ cmd: "start", tabId: 2 }, ctx);

  emit(1, "Network.requestWillBeSent", {
    requestId: "shared",
    request: { url: "https://one.example", method: "GET", headers: {} },
    type: "Document",
    timestamp: 1,
  });
  emit(2, "Network.requestWillBeSent", {
    requestId: "shared",
    request: { url: "https://two.example", method: "POST", headers: {} },
    type: "Fetch",
    timestamp: 2,
  });

  await expect(network.execute({ cmd: "list", tabId: 1 }, ctx)).resolves.toMatchObject({
    requests: [{ url: "https://one.example" }],
  });
  await expect(network.execute({ cmd: "list", tabId: 2 }, ctx)).resolves.toMatchObject({
    requests: [{ url: "https://two.example" }],
  });
  expect(addListener).toHaveBeenCalledTimes(1);

  await network.execute({ cmd: "stop", tabId: 1 }, ctx);
  expect(removeListener).not.toHaveBeenCalled();
  await network.execute({ cmd: "stop", tabId: 2 }, ctx);
  expect(removeListener).toHaveBeenCalledTimes(1);
});
