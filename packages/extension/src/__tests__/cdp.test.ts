import { describe, it, expect, vi, beforeEach } from "vitest";
import { CDPController } from "../cdp/controller.js";

const mockDebuggerAttach = vi.fn();
const mockDebuggerDetach = vi.fn();
const mockDebuggerSend = vi.fn();
const mockTabsGet = vi.fn();
const mockTabsQuery = vi.fn();

(globalThis as Record<string, unknown>).chrome = {
  debugger: {
    attach: mockDebuggerAttach,
    detach: mockDebuggerDetach,
    sendCommand: (target: { tabId: number }, method: string, params?: Record<string, never>) => {
      return mockDebuggerSend(target, method, params);
    },
  },
  tabs: {
    get: (tabId: number) => mockTabsGet(tabId),
    query: (info: chrome.tabs.QueryInfo) => mockTabsQuery(info),
  },
};

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("CDPController", () => {
  let controller: CDPController;

  beforeEach(() => {
    controller = new CDPController();
    mockDebuggerAttach.mockReset().mockResolvedValue(undefined);
    mockDebuggerDetach.mockReset().mockResolvedValue(undefined);
    mockDebuggerSend.mockReset();
    mockTabsGet.mockReset();
    mockTabsQuery.mockReset();
  });

  it("routes commands through the requested tab session", async () => {
    mockDebuggerSend.mockResolvedValue({ result: { value: 42 } });

    const result = await controller.run(42, (tab) =>
      tab.send<{ result: { value: number } }>("Runtime.evaluate", { expression: "40+2" }),
    );

    expect(result.result.value).toBe(42);
    expect(mockDebuggerAttach).toHaveBeenCalledWith({ tabId: 42 }, "1.3");
    expect(mockDebuggerSend).toHaveBeenCalledWith({ tabId: 42 }, "Runtime.evaluate", { expression: "40+2" });
  });

  it("serializes complete operations for one tab", async () => {
    const firstGate = deferred();
    const firstStarted = deferred();
    const order: string[] = [];

    const first = controller.run(42, async () => {
      order.push("first:start");
      firstStarted.resolve();
      await firstGate.promise;
      order.push("first:end");
    });
    const second = controller.run(42, async () => {
      order.push("second:start");
      order.push("second:end");
    });

    await firstStarted.promise;
    expect(order).toEqual(["first:start"]);
    firstGate.resolve();
    await Promise.all([first, second]);

    expect(order).toEqual(["first:start", "first:end", "second:start", "second:end"]);
    expect(mockDebuggerAttach).toHaveBeenCalledTimes(1);
  });

  it("runs operations for different tabs in parallel", async () => {
    const firstGate = deferred();
    const secondStarted = deferred();
    const order: string[] = [];

    const first = controller.run(1, async () => {
      order.push("first:start");
      await firstGate.promise;
      order.push("first:end");
    });
    const second = controller.run(2, async () => {
      order.push("second:start");
      secondStarted.resolve();
      order.push("second:end");
    });

    await secondStarted.promise;
    expect(order).toEqual(["first:start", "second:start", "second:end"]);
    firstGate.resolve();
    await Promise.all([first, second]);
  });

  it("continues a tab queue after an operation fails", async () => {
    const failed = controller.run(42, async () => {
      throw new Error("operation failed");
    });
    const next = controller.run(42, async () => "complete");

    await expect(failed).rejects.toThrow("operation failed");
    await expect(next).resolves.toBe("complete");
  });

  it("detaches after active work for the same tab", async () => {
    const gate = deferred();
    const started = deferred();

    const operation = controller.run(42, async () => {
      started.resolve();
      await gate.promise;
    });
    await started.promise;
    const detach = controller.detach(42);

    expect(mockDebuggerDetach).toHaveBeenCalledTimes(1);
    gate.resolve();
    await Promise.all([operation, detach]);

    expect(mockDebuggerDetach).toHaveBeenCalledTimes(2);
  });

  it("gets the active tab from the browser query", async () => {
    mockTabsQuery.mockResolvedValue([{ id: 99, url: "https://example.com" }]);

    const tab = await controller.getActiveTab();

    expect(tab.id).toBe(99);
  });
});
