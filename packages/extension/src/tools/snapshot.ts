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

const INTERACTIVE_ROLES = new Set([
  "button",
  "checkbox",
  "combobox",
  "link",
  "menuitem",
  "option",
  "radio",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
]);

function filterSnapshotTree(roots: SnapshotElement[], params: Record<string, unknown>): SnapshotElement[] {
  const roles = Array.isArray(params.roles)
    ? new Set(params.roles.filter((role): role is string => typeof role === "string"))
    : null;
  const nameContains = typeof params.name_contains === "string" ? params.name_contains.toLowerCase() : "";
  const maxDepth = typeof params.depth === "number" && params.depth >= 0 ? params.depth : null;
  const interactiveOnly = params.interactive_only === true;

  if (!roles && !nameContains && maxDepth === null && !interactiveOnly) return roots;

  function matches(element: SnapshotElement): boolean {
    if (roles && !roles.has(element.role)) return false;
    if (interactiveOnly && !INTERACTIVE_ROLES.has(element.role)) return false;
    if (nameContains && !(element.name || "").toLowerCase().includes(nameContains)) return false;
    return true;
  }

  function visit(element: SnapshotElement, depth: number): SnapshotElement | null {
    const atLimit = maxDepth !== null && depth >= maxDepth;
    const children = atLimit
      ? []
      : (element.children || [])
          .map((child) => visit(child, depth + 1))
          .filter((child): child is SnapshotElement => child !== null);
    const selfMatches = matches(element);

    if (!selfMatches && children.length === 0) return null;

    const next: SnapshotElement = {
      role: element.role,
      name: element.name,
      value: element.value,
      ref: element.ref,
    };
    if (children.length > 0) {
      next.children = children;
    }
    if (atLimit && (element.children?.length || 0) > 0) {
      next.truncated = true;
    }
    return next;
  }

  return roots.map((root) => visit(root, 0)).filter((root): root is SnapshotElement => root !== null);
}

export const snapshotTool: ToolExecutor = {
  name: "snapshot",
  async execute(params, ctx) {
    const tabId = await getTabId(params, ctx);
    if (tabId === undefined || tabId === null) {
      throw new Error("snapshot: getTabId returned invalid: " + JSON.stringify({ params, tabId }));
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
      result = await ctx.cdp.send<GetFullAXTreeResult>("Accessibility.getFullAXTree");
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

      if ((role === "none" || role === "generic") && node.childIds && node.childIds.length > 0) {
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

    return filterSnapshotTree(roots, params);
  },
};

registerTool(snapshotTool);
