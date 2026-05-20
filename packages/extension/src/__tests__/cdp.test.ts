import { describe, it, expect, vi, beforeEach } from "vitest";
import { CDPController } from "../cdp/controller.js";

const mockDebuggerSend = vi.fn();
const mockTabsGet = vi.fn();
const mockTabsQuery = vi.fn();

(globalThis as Record<string, unknown>).chrome = {
  debugger: {
    attach: vi.fn().mockResolvedValue(undefined),
    detach: vi.fn().mockResolvedValue(undefined),
    sendCommand: (_target: { tabId: number }, method: string, params?: Record<string, never>) => {
      return mockDebuggerSend(method, params);
    },
  },
  tabs: {
    get: (tabId: number) => mockTabsGet(tabId),
    query: (info: chrome.tabs.QueryInfo) => mockTabsQuery(info),
  },
};

describe("CDPController", () => {
  let controller: CDPController;

  beforeEach(() => {
    controller = new CDPController();
    mockDebuggerSend.mockReset();
    mockTabsGet.mockReset();
    mockTabsQuery.mockReset();
  });

  it("should attach to a tab", async () => {
    await controller.attach(42);
    expect(controller.getCurrentTabId()).toBe(42);
  });

  it("should throw when sending without attached tab", async () => {
    await expect(controller.send("Runtime.evaluate", { expression: "1+1" }))
      .rejects.toThrow("No tab attached");
  });

  it("should send CDP commands", async () => {
    mockDebuggerSend.mockResolvedValue({ result: { value: 42 } });
    await controller.attach(42);
    const result = await controller.send<{ result: { value: number } }>(
      "Runtime.evaluate",
      { expression: "40+2" }
    );
    expect(result.result.value).toBe(42);
    expect(mockDebuggerSend).toHaveBeenCalledWith("Runtime.evaluate", { expression: "40+2" });
  });

  it("should detach from a tab", async () => {
    await controller.attach(42);
    await controller.detach(42);
    expect(controller.getCurrentTabId()).toBeNull();
  });

  it("should get active tab from query when no attached tab", async () => {
    mockTabsQuery.mockResolvedValue([{ id: 99, url: "https://example.com" }]);
    const tab = await controller.getActiveTab();
    expect(tab.id).toBe(99);
  });
});
