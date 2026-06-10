import { registerTool, getTabId, type ToolExecutor } from "./index.js";
import type { SnapshotElement } from "@qweb/protocol";

interface AXNode {
  nodeId: number;
  backendDOMNodeId: number;
  role?: { value: string };
  name?: { value: string };
  value?: { value: string };
  childIds?: number[];
}

interface GetFullAXTreeResult {
  nodes: AXNode[];
}

export const snapshotTool: ToolExecutor = {
  name: "snapshot",
  async execute(_params, ctx) {
    const tabId = await getTabId(_params, ctx);
    if (tabId === undefined || tabId === null) {
      throw new Error("snapshot: getTabId returned invalid: " + JSON.stringify({_params, tabId}));
    }
    try {
      await ctx.cdp.attach(tabId);
    } catch (e) {
      throw new Error(`snapshot: attach failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    let result: GetFullAXTreeResult;
    try {
      await ctx.cdp.send("Accessibility.enable");
    } catch {}
    try {
      result = await ctx.cdp.send<GetFullAXTreeResult>(
        "Accessibility.getFullAXTree"
      );
    } catch (e) {
      throw new Error(`snapshot CDP error: ${e instanceof Error ? e.message : String(e)}`);
    }

    ctx.refs.clear();
    let refIndex = 0;

    const nodeMap = new Map<number, AXNode>();
    for (const node of result.nodes) {
      nodeMap.set(node.nodeId, node);
    }

    function buildElement(node: AXNode): SnapshotElement | null {
      const role = node.role?.value || "";

      if (
        (role === "none" || role === "generic") &&
        node.childIds &&
        node.childIds.length > 0
      ) {
        const children: SnapshotElement[] = [];
        for (const childId of node.childIds) {
          const child = nodeMap.get(childId);
          if (child) {
            const childEl = buildElement(child);
            if (childEl) children.push(childEl);
          }
        }
        if (children.length === 0) return null;
        if (children.length === 1) return children[0];
        const groupRef = `e${refIndex++}`;
        ctx.refs.set(groupRef, node.backendDOMNodeId);
        return { role: "group", ref: `@${groupRef}`, children };
      }

      const ref = `e${refIndex++}`;
      ctx.refs.set(ref, node.backendDOMNodeId);

      const element: SnapshotElement = {
        role,
        name: node.name?.value,
        value: node.value?.value,
        ref: `@${ref}`,
        children: [],
      };

      if (node.childIds) {
        for (const childId of node.childIds) {
          const child = nodeMap.get(childId);
          if (child) {
            const childEl = buildElement(child);
            if (childEl) {
              element.children!.push(childEl);
            }
          }
        }
      }

      return element;
    }

    const hasParent = new Set<number>();
    for (const node of result.nodes) {
      if (node.childIds) {
        for (const childId of node.childIds) {
          hasParent.add(childId);
        }
      }
    }

    const roots: SnapshotElement[] = [];
    for (const node of result.nodes) {
      if (!hasParent.has(node.nodeId)) {
        const el = buildElement(node);
        if (el) roots.push(el);
      }
    }

    return roots;
  },
};

registerTool(snapshotTool);
