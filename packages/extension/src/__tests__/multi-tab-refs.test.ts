import { expect, it } from "vitest";
import { RefStore } from "../ref-store.js";
import { getTool, type ToolContext } from "../tools/index.js";
import "../tools/batch.js";
import "../tools/click.js";

it("keeps refs bound to their source tabs", async () => {
  let currentTabId = 0;
  const resolvedNodes: Array<{ tabId: number; backendNodeId: number }> = [];
  const backendNodeIds = new Map([
    [1, 101],
    [2, 202],
  ]);
  const cdp = {
    async attach(tabId: number) {
      currentTabId = tabId;
    },
    async send<T>(method: string, params?: Record<string, unknown>): Promise<T> {
      if (method === "Accessibility.getFullAXTree") {
        return {
          nodes: [
            {
              nodeId: 1,
              backendDOMNodeId: backendNodeIds.get(currentTabId),
              role: { value: "button" },
            },
          ],
        } as T;
      }
      if (method === "Runtime.evaluate") {
        return { result: { type: "number" }, executionContextId: 1 } as T;
      }
      if (method === "DOM.resolveNode") {
        resolvedNodes.push({
          tabId: currentTabId,
          backendNodeId: params?.backendNodeId as number,
        });
        return { object: { objectId: "node" } } as T;
      }
      if (method === "Runtime.callFunctionOn") {
        return { result: { value: { success: true } } } as T;
      }
      return {} as T;
    },
    async getActiveTab() {
      return { id: currentTabId };
    },
  };
  const ctx = { cdp, refs: new RefStore() } as unknown as ToolContext;

  await getTool("multi_snapshot")!.execute({ tabIds: [1, 2] }, ctx);
  await getTool("click")!.execute({ tabId: 1, selector: "@e0" }, ctx);
  await getTool("click")!.execute({ tabId: 2, selector: "@e0" }, ctx);

  expect(resolvedNodes).toEqual([
    { tabId: 1, backendNodeId: 101 },
    { tabId: 2, backendNodeId: 202 },
  ]);
});
