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
    expect(mockDebuggerDetach).not.toHaveBeenCalled();
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

  it("limits concurrent operations across tabs", async () => {
    const limitedController = new CDPController({ maxConcurrentTabOperations: 2 });
    const gate = deferred();
    const twoStarted = deferred();
    let active = 0;
    let started = 0;
    let maxActive = 0;

    const run = (tabId: number) =>
      limitedController.run(tabId, async () => {
        active += 1;
        started += 1;
        maxActive = Math.max(maxActive, active);
        if (started === 2) twoStarted.resolve();
        await gate.promise;
        active -= 1;
      });

    const operations = [run(1), run(2), run(3)];
    await twoStarted.promise;

    expect(started).toBe(2);
    expect(maxActive).toBe(2);

    gate.resolve();
    await Promise.all(operations);
    expect(started).toBe(3);
  });

  it("does not reserve global capacity for an operation waiting in a tab queue", async () => {
    const limitedController = new CDPController({ maxConcurrentTabOperations: 2 });
    const firstGate = deferred();
    const firstStarted = deferred();
    const otherTabStarted = deferred();

    const first = limitedController.run(1, async () => {
      firstStarted.resolve();
      await firstGate.promise;
    });
    await firstStarted.promise;
    const queued = limitedController.run(1, async () => undefined);
    const otherTab = limitedController.run(2, async () => {
      otherTabStarted.resolve();
    });

    await otherTabStarted.promise;
    firstGate.resolve();
    await Promise.all([first, queued, otherTab]);
  });

  it("cancels a tab operation that is waiting for global capacity", async () => {
    const limitedController = new CDPController({ maxConcurrentTabOperations: 1 });
    const gate = deferred();
    const firstStarted = deferred();
    let secondStarted = false;

    const first = limitedController.run(1, async () => {
      firstStarted.resolve();
      await gate.promise;
    });
    await firstStarted.promise;
    const second = limitedController.run(2, async () => {
      secondStarted = true;
    });

    await limitedController.close(2);

    await expect(second).rejects.toMatchObject({ code: "tab_closed" });
    expect(secondStarted).toBe(false);

    gate.resolve();
    await first;
  });

  it("rejects new operations after a tab closes", async () => {
    await controller.close(42);

    await expect(controller.run(42, async () => "unexpected")).rejects.toMatchObject({
      code: "tab_closed",
    });
  });

  it("cancels queued operations when their tab closes", async () => {
    const gate = deferred();
    const firstStarted = deferred();
    let secondStarted = false;

    const first = controller.run(42, async () => {
      firstStarted.resolve();
      await gate.promise;
    });
    const second = controller.run(42, async () => {
      secondStarted = true;
    });
    await firstStarted.promise;

    await controller.close(42);
    gate.resolve();

    await expect(first).rejects.toMatchObject({ code: "tab_closed" });
    await expect(second).rejects.toMatchObject({ code: "tab_closed" });
    expect(secondStarted).toBe(false);
  });

  it("allows a new operation after an unexpected debugger detach", async () => {
    const gate = deferred();
    const started = deferred();
    const interrupted = controller.run(42, async () => {
      started.resolve();
      await gate.promise;
    });
    await started.promise;

    controller.handleDetach(42);
    gate.resolve();

    await expect(interrupted).rejects.toMatchObject({ code: "operation_aborted" });
    await expect(controller.run(42, async () => "recovered")).resolves.toBe("recovered");
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

    expect(mockDebuggerDetach).not.toHaveBeenCalled();
    gate.resolve();
    await Promise.all([operation, detach]);

    expect(mockDebuggerDetach).toHaveBeenCalledTimes(1);
  });

  it("gets the active tab from the browser query", async () => {
    mockTabsQuery.mockResolvedValue([{ id: 99, url: "https://example.com" }]);

    const tab = await controller.getActiveTab();

    expect(tab.id).toBe(99);
  });
});
