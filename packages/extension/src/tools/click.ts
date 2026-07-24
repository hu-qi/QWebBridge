import type { CDPTabSession } from "../cdp/controller.js";
import { registerTool, getTabId, type ToolExecutor, type ToolContext } from "./index.js";

const clickTool: ToolExecutor = {
  name: "click",
  async execute(params, ctx) {
    const selector = params.selector as string;
    if (!selector) throw new Error("click: selector is required");

    const tabId = await getTabId(params, ctx);
    return ctx.cdp.run(tabId, (tab) => {
      if (ctx.refs.isRef(selector)) {
        return clickByRef(selector, tabId, tab, ctx);
      }
      return clickBySelector(selector, tab);
    });
  },
};

async function getExecutionContextId(tab: CDPTabSession): Promise<number> {
  const result = await tab.send<{ result: { type: string }; executionContextId?: number }>("Runtime.evaluate", {
    expression: "1",
    returnByValue: true,
  });
  if (result.executionContextId) return result.executionContextId;
  const contexts = await tab
    .send<{ contexts: { id: number; origin: string; name: string }[] }>("Runtime.executionContexts")
    .catch(() => ({ contexts: [] }));
  const pageCtx = contexts.contexts?.find((c: { origin: string; name: string }) => !c.origin.startsWith("chrome"));
  return pageCtx?.id ?? 1;
}

async function clickByRef(ref: string, tabId: number, tab: CDPTabSession, ctx: ToolContext): Promise<unknown> {
  const refName = ref.startsWith("@") ? ref.slice(1) : ref;
  const entry = ctx.refs.get(tabId, refName);
  if (!entry) throw new Error(`click: unknown ref "${ref}". Run snapshot first to get refs.`);

  const contextId = await getExecutionContextId(tab);

  const resolveResult = await tab.send<{ object: { objectId: string } }>("DOM.resolveNode", {
    backendNodeId: entry.backendDOMNodeId,
    executionContextId: contextId,
  });

  if (!resolveResult.object?.objectId) throw new Error(`click: could not resolve ref "${ref}"`);

  const result = await tab.send<{ result: { value: unknown }; exceptionDetails?: { text: string } }>(
    "Runtime.callFunctionOn",
    {
      objectId: resolveResult.object.objectId,
      functionDeclaration: `function() {
        this.scrollIntoView({ block: 'center' });
        this.click();
        return { success: true, tag: this.tagName, text: (this.textContent || '').slice(0, 100) };
      }`,
      returnByValue: true,
    },
  );

  if (result.exceptionDetails) throw new Error(`click: ${result.exceptionDetails.text}`);
  return result.result.value || { success: true };
}

async function clickBySelector(selector: string, tab: CDPTabSession): Promise<unknown> {
  const result = await tab.send<{ result: { value: unknown }; exceptionDetails?: { text: string } }>(
    "Runtime.evaluate",
    {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { error: 'element not found: ${selector.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' };
        el.scrollIntoView({ block: 'center' });
        el.click();
        return { success: true, tag: el.tagName, text: (el.textContent || '').slice(0, 100) };
      })()`,
      returnByValue: true,
    },
  );

  if (result.exceptionDetails) throw new Error(`click: ${result.exceptionDetails.text}`);
  const value = result.result.value as { error?: string; success?: boolean; tag?: string; text?: string };
  if (value?.error) throw new Error(value.error);
  return value || { success: true };
}

registerTool(clickTool);
