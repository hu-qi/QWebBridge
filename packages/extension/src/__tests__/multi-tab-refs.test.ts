import { expect, it, vi } from "vitest";
import { RefStore } from "../ref-store.js";
import { getTool, type ToolContext } from "../tools/index.js";
import "../tools/batch.js";
import "../tools/click.js";
import "../tools/fill.js";
import "../tools/mouse-click.js";
import "../tools/upload.js";
import "../tools/wait-for.js";

function createContext(refs = new RefStore()) {
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
        if (params?.awaitPromise === true) {
          return {
            result: {
              value: { success: true, found: true, elapsed_ms: 0, marked: true },
            },
          } as T;
        }
        return {
          result: { type: "object", value: { success: true } },
          executionContextId: 1,
        } as T;
      }
      if (method === "DOM.resolveNode") {
        resolvedNodes.push({
          tabId: currentTabId,
          backendNodeId: params?.backendNodeId as number,
        });
        return { object: { objectId: "node" } } as T;
      }
      if (method === "Runtime.callFunctionOn") {
        const declaration = params?.functionDeclaration;
        if (typeof declaration === "string" && declaration.includes("getBoundingClientRect")) {
          return {
            result: {
              value: { x: 0, y: 0, w: 10, h: 10, tag: "BUTTON", text: "button" },
            },
          } as T;
        }
        return { result: { value: { success: true } } } as T;
      }
      if (method === "DOM.pushNodesByBackendIdsToFrontend") {
        return { nodeIds: [1] } as T;
      }
      if (method === "DOM.getDocument") {
        return { root: { nodeId: 1 } } as T;
      }
      if (method === "DOM.querySelector") {
        return { nodeId: 2 } as T;
      }
      if (method === "DOM.describeNode") {
        return { node: { backendNodeId: 303 } } as T;
      }
      return {} as T;
    },
    async getActiveTab() {
      return { id: currentTabId };
    },
  };
  const ctx = { cdp, refs } as unknown as ToolContext;
  return { ctx, refs, resolvedNodes };
}

it("keeps refs bound to their source tabs", async () => {
  const { ctx, resolvedNodes } = createContext();

  await getTool("multi_snapshot")!.execute({ tabIds: [1, 2] }, ctx);
  await getTool("click")!.execute({ tabId: 1, selector: "@e0" }, ctx);
  await getTool("click")!.execute({ tabId: 2, selector: "@e0" }, ctx);

  expect(resolvedNodes).toEqual([
    { tabId: 1, backendNodeId: 101 },
    { tabId: 2, backendNodeId: 202 },
  ]);
});

it.each([
  ["click", { tabId: 1, selector: "@e0" }],
  ["fill", { tabId: 1, selector: "@e0", value: "text" }],
  ["mouse_click", { tabId: 1, selector: "@e0" }],
  ["upload", { tabId: 1, selector: "@e0", files: ["/tmp/input.txt"] }],
])("%s reads refs from the requested tab", async (toolName, params) => {
  const refs = new RefStore();
  refs.set(1, "e0", 101);
  refs.set(2, "e0", 202);
  const getRef = vi.spyOn(refs, "get");
  const { ctx } = createContext(refs);

  await getTool(toolName)!.execute(params, ctx);

  expect(getRef).toHaveBeenCalledWith(1, "e0");
});

it("stores wait_for refs for the requested tab", async () => {
  const refs = new RefStore();
  const setRef = vi.spyOn(refs, "set");
  const { ctx } = createContext(refs);

  const result = (await getTool("wait_for")!.execute({ tabId: 1, selector: "#ready", timeout: 1 }, ctx)) as {
    ref: string;
  };
  const refName = result.ref.slice(1);

  expect(setRef).toHaveBeenCalledWith(1, refName, 303);
  expect(refs.get(1, refName)?.backendDOMNodeId).toBe(303);
  expect(refs.get(2, refName)).toBeUndefined();
});
