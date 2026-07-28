import { expect, it, vi } from "vitest";
import { RefStore } from "../ref-store.js";
import { getTool, type ToolContext } from "../tools/index.js";
import { ToolError } from "../tool-error.js";
import { ERROR_CODES } from "@qweb/protocol";
import "../tools/batch.js";
import "../tools/click.js";
import "../tools/fill.js";
import "../tools/mouse-click.js";
import "../tools/upload.js";
import "../tools/wait-for.js";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createContext(refs = new RefStore()) {
  const resolvedNodes: Array<{ tabId: number; backendNodeId: number }> = [];
  const runTabIds: number[] = [];
  const backendNodeIds = new Map([
    [1, 101],
    [2, 202],
  ]);
  const cdp = {
    async run<T>(
      tabId: number,
      operation: (tab: {
        tabId: number;
        send<R>(method: string, params?: Record<string, unknown>): Promise<R>;
      }) => Promise<T>,
    ): Promise<T> {
      runTabIds.push(tabId);
      return operation({
        tabId,
        send: <R>(method: string, params?: Record<string, unknown>) => send<R>(tabId, method, params),
      });
    },
    async getActiveTab() {
      return { id: 0 };
    },
  };

  async function send<T>(tabId: number, method: string, params?: Record<string, unknown>): Promise<T> {
    if (method === "Accessibility.getFullAXTree") {
      return {
        nodes: [
          {
            nodeId: 1,
            backendDOMNodeId: backendNodeIds.get(tabId),
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
        tabId,
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
  }

  const ctx = { cdp, refs } as unknown as ToolContext;
  return { ctx, refs, resolvedNodes, runTabIds };
}

it("starts snapshots for different tabs in parallel", async () => {
  const firstGate = deferred();
  const secondStarted = deferred();
  const refs = new RefStore();
  const cdp = {
    async run<T>(
      tabId: number,
      operation: (tab: {
        tabId: number;
        send<R>(method: string, params?: Record<string, unknown>): Promise<R>;
      }) => Promise<T>,
    ): Promise<T> {
      if (tabId === 1) await firstGate.promise;
      if (tabId === 2) secondStarted.resolve();
      return operation({
        tabId,
        async send<R>(method: string): Promise<R> {
          if (method === "Accessibility.getFullAXTree") return { nodes: [] } as R;
          return {} as R;
        },
      });
    },
  };
  const ctx = { cdp, refs } as unknown as ToolContext;

  const snapshots = getTool("multi_snapshot")!.execute({ tabIds: [1, 2] }, ctx);
  await secondStarted.promise;
  firstGate.resolve();

  await expect(snapshots).resolves.toEqual({
    results: [
      { tabId: 1, tree: [] },
      { tabId: 2, tree: [] },
    ],
  });
});

it("preserves structured errors in multi-tab results", async () => {
  const ctx = {
    cdp: {
      async run(): Promise<never> {
        throw new ToolError(ERROR_CODES.TAB_CLOSED, "Tab 1 is closed.");
      },
    },
    refs: new RefStore(),
  } as unknown as ToolContext;

  await expect(getTool("multi_snapshot")!.execute({ tabIds: [1] }, ctx)).resolves.toEqual({
    results: [
      {
        tabId: 1,
        errorCode: "tab_closed",
        error: "Tab 1 is closed.",
      },
    ],
  });
});

it("keeps refs bound to their source tabs", async () => {
  const { ctx, resolvedNodes } = createContext();

  const result = (await getTool("multi_snapshot")!.execute({ tabIds: [1, 2] }, ctx)) as {
    results: Array<{ tree: Array<{ ref: string }> }>;
  };
  await getTool("click")!.execute({ selector: result.results[0].tree[0].ref }, ctx);
  await getTool("click")!.execute({ selector: result.results[1].tree[0].ref }, ctx);

  expect(resolvedNodes).toEqual([
    { tabId: 1, backendNodeId: 101 },
    { tabId: 2, backendNodeId: 202 },
  ]);
});

it("routes an opaque snapshot ref without an explicit tabId", async () => {
  const { ctx, resolvedNodes } = createContext();
  const snapshot = (await getTool("snapshot")!.execute({ tabId: 1 }, ctx)) as Array<{ ref: string }>;

  await getTool("click")!.execute({ selector: snapshot[0].ref }, ctx);

  expect(snapshot[0].ref).toMatch(/^@qref_v1_/);
  expect(resolvedNodes).toEqual([{ tabId: 1, backendNodeId: 101 }]);
});

it("rejects a ref invalidated by an earlier queued snapshot", async () => {
  const refs = new RefStore();
  const oldRef = refs.issue(1, 101);
  const snapshotStarted = deferred();
  const releaseSnapshot = deferred();
  let tail = Promise.resolve<unknown>(undefined);
  const cdp = {
    run<T>(
      tabId: number,
      operation: (tab: {
        tabId: number;
        send<R>(method: string, params?: Record<string, unknown>): Promise<R>;
      }) => Promise<T>,
    ): Promise<T> {
      const result = tail.then(() =>
        operation({
          tabId,
          async send<R>(method: string): Promise<R> {
            if (method === "Accessibility.getFullAXTree") {
              snapshotStarted.resolve();
              await releaseSnapshot.promise;
              return {
                nodes: [{ nodeId: 1, backendDOMNodeId: 202, role: { value: "button" } }],
              } as R;
            }
            if (method === "Runtime.evaluate") {
              return { result: { type: "number", value: 1 }, executionContextId: 1 } as R;
            }
            if (method === "DOM.resolveNode") {
              return { object: { objectId: "old-node" } } as R;
            }
            if (method === "Runtime.callFunctionOn") {
              return { result: { value: { success: true } } } as R;
            }
            return {} as R;
          },
        }),
      );
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    async getActiveTab() {
      return { id: 1 };
    },
  };
  const ctx = { cdp, refs } as unknown as ToolContext;

  const snapshot = getTool("snapshot")!.execute({ tabId: 1 }, ctx);
  await snapshotStarted.promise;
  const click = getTool("click")!.execute({ selector: oldRef }, ctx);
  releaseSnapshot.resolve();

  await snapshot;
  await expect(click).rejects.toMatchObject({ code: ERROR_CODES.STALE_REF });
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

it.each([
  ["click", { selector: "" }],
  ["fill", { selector: "", value: "text" }],
  ["mouse_click", { selector: "" }],
  ["upload", { selector: "", files: ["/tmp/input.txt"] }],
])("%s routes an opaque ref without tabId", async (toolName, params) => {
  const refs = new RefStore();
  const ref = refs.issue(1, 101);
  const { ctx, runTabIds } = createContext(refs);

  await getTool(toolName)!.execute({ ...params, selector: ref }, ctx);

  expect(runTabIds).toEqual([1]);
});

it("requires tabId for a legacy ref", async () => {
  const refs = new RefStore();
  refs.set(1, "e0", 101);
  const { ctx } = createContext(refs);

  await expect(getTool("click")!.execute({ selector: "@e0" }, ctx)).rejects.toMatchObject({
    code: "invalid_params",
  });
});

it("rejects a tabId that conflicts with an opaque ref", async () => {
  const refs = new RefStore();
  const ref = refs.issue(1, 101);
  const { ctx, runTabIds } = createContext(refs);

  await expect(getTool("click")!.execute({ tabId: 2, selector: ref }, ctx)).rejects.toMatchObject({
    code: "ref_tab_mismatch",
  });
  expect(runTabIds).toEqual([]);
});

it.each([
  ["click", { selector: "" }],
  ["fill", { selector: "", value: "text" }],
  ["mouse_click", { selector: "" }],
  ["upload", { selector: "", files: ["/tmp/input.txt"] }],
])("%s reports a detached DOM node for an opaque ref", async (toolName, params) => {
  const refs = new RefStore();
  const ref = refs.issue(1, 101);
  const cdp = {
    async run<T>(
      tabId: number,
      operation: (tab: { tabId: number; send<R>(method: string): Promise<R> }) => Promise<T>,
    ): Promise<T> {
      return operation({
        tabId,
        async send<R>(method: string): Promise<R> {
          if (method === "Runtime.evaluate") {
            return { result: { type: "number", value: 1 }, executionContextId: 1 } as R;
          }
          if (method === "DOM.resolveNode" || method === "DOM.pushNodesByBackendIdsToFrontend") {
            throw new Error("No node with given id found");
          }
          return {} as R;
        },
      });
    },
  };
  const ctx = { cdp, refs } as unknown as ToolContext;

  await expect(getTool(toolName)!.execute({ ...params, selector: ref }, ctx)).rejects.toMatchObject({
    code: "node_detached",
  });
  expect(() => refs.resolve(ref)).toThrowError(
    expect.objectContaining({
      code: "node_detached",
    }),
  );
});

it.each([
  ["click", { selector: "" }, ERROR_CODES.TAB_CLOSED],
  ["click", { selector: "" }, ERROR_CODES.OPERATION_ABORTED],
  ["fill", { selector: "", value: "text" }, ERROR_CODES.TAB_CLOSED],
  ["fill", { selector: "", value: "text" }, ERROR_CODES.OPERATION_ABORTED],
  ["mouse_click", { selector: "" }, ERROR_CODES.TAB_CLOSED],
  ["mouse_click", { selector: "" }, ERROR_CODES.OPERATION_ABORTED],
  ["upload", { selector: "", files: ["/tmp/input.txt"] }, ERROR_CODES.TAB_CLOSED],
  ["upload", { selector: "", files: ["/tmp/input.txt"] }, ERROR_CODES.OPERATION_ABORTED],
])("%s preserves structured errors during node resolution", async (toolName, params, errorCode) => {
  const refs = new RefStore();
  const ref = refs.issue(1, 101);
  const originalError = new ToolError(errorCode, `Original ${errorCode} error.`);
  const cdp = {
    async run<T>(
      tabId: number,
      operation: (tab: { tabId: number; send<R>(method: string): Promise<R> }) => Promise<T>,
    ): Promise<T> {
      return operation({
        tabId,
        async send<R>(method: string): Promise<R> {
          if (method === "Runtime.evaluate") {
            return { result: { type: "number", value: 1 }, executionContextId: 1 } as R;
          }
          if (method === "DOM.resolveNode" || method === "DOM.pushNodesByBackendIdsToFrontend") {
            throw originalError;
          }
          return {} as R;
        },
      });
    },
  };
  const ctx = { cdp, refs } as unknown as ToolContext;

  await expect(getTool(toolName)!.execute({ ...params, selector: ref }, ctx)).rejects.toBe(originalError);
  expect(refs.resolve(ref)).toMatchObject({ tabId: 1, backendDOMNodeId: 101 });
});

it("stores wait_for refs for the requested tab", async () => {
  const refs = new RefStore();
  const { ctx, resolvedNodes } = createContext(refs);

  const result = (await getTool("wait_for")!.execute({ tabId: 1, selector: "#ready", timeout: 1 }, ctx)) as {
    ref: string;
  };
  await getTool("click")!.execute({ selector: result.ref }, ctx);

  expect(result.ref).toMatch(/^@qref_v1_/);
  expect(resolvedNodes).toEqual([{ tabId: 1, backendNodeId: 303 }]);
});
