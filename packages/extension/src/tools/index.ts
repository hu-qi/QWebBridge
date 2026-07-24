import type { CDPController } from "../cdp/controller.js";
import type { RefStore } from "../ref-store.js";

export interface ToolContext {
  cdp: CDPController;
  refs: RefStore;
}

export async function getTabId(params: Record<string, unknown>, ctx: ToolContext): Promise<number> {
  const tabId = params._tabId ?? params.tabId;
  if (tabId !== undefined) {
    if (typeof tabId !== "number" || !Number.isInteger(tabId) || tabId < 0) {
      throw new Error("tabId must be a non-negative integer");
    }
    return tabId;
  }
  const tab = await ctx.cdp.getActiveTab();
  return tab.id!;
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
