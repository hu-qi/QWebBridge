import type { CDPController } from "../cdp/controller.js";
import type { RefStore } from "../ref-store.js";
import { ERROR_CODES } from "@qweb/protocol";
import { ToolError } from "../tool-error.js";

export interface ToolContext {
  cdp: CDPController;
  refs: RefStore;
}

export function getExplicitTabId(params: Record<string, unknown>): number | undefined {
  const tabId = params._tabId ?? params.tabId;
  if (tabId !== undefined) {
    if (typeof tabId !== "number" || !Number.isInteger(tabId) || tabId < 0) {
      throw new Error("tabId must be a non-negative integer");
    }
    return tabId;
  }
  return undefined;
}

export async function getTabId(params: Record<string, unknown>, ctx: ToolContext): Promise<number> {
  const tabId = getExplicitTabId(params);
  if (tabId !== undefined) return tabId;
  const tab = await ctx.cdp.getActiveTab();
  return tab.id!;
}

export async function resolveToolTarget(
  params: Record<string, unknown>,
  ctx: ToolContext,
  selector?: string,
): Promise<{ tabId: number }> {
  if (selector && ctx.refs.isRef(selector)) {
    const requestedTabId = getExplicitTabId(params);
    const owningTabId = ctx.refs.getOwningTab(selector, requestedTabId);
    if (owningTabId !== undefined) return { tabId: owningTabId };
    if (requestedTabId === undefined) {
      throw new ToolError(ERROR_CODES.INVALID_PARAMS, "Legacy refs require an explicit tabId.");
    }
    return { tabId: requestedTabId };
  }
  return { tabId: await getTabId(params, ctx) };
}

export function handleNodeResolutionError(error: unknown, ref: string, refs: Pick<RefStore, "rejectDetached">): never {
  if (error instanceof ToolError) throw error;
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("No node with given id found") || message.includes("Could not find node with given id")) {
    refs.rejectDetached(ref);
  }
  throw error;
}

export interface ToolExecutor {
  name: string;
  execute(params: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
}

const registry = new Map<string, ToolExecutor>();

export function registerTool(executor: ToolExecutor): void {
  registry.set(executor.name, executor);
}

export function getTool(name: string): ToolExecutor | undefined {
  return registry.get(name);
}

export function getAllToolNames(): string[] {
  return Array.from(registry.keys());
}
