import { registerTool, type ToolExecutor, type ToolContext } from "./index.js";

const clickTool: ToolExecutor = {
  name: "click",
  async execute(params, ctx) {
    const selector = params.selector as string;
    if (!selector) throw new Error("click: selector is required");

    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    if (ctx.refs.isRef(selector)) {
      return clickByRef(selector, ctx);
    }
    return clickBySelector(selector, ctx);
  },
};

async function clickByRef(ref: string, ctx: ToolContext): Promise<unknown> {
  const refName = ref.startsWith("@") ? ref.slice(1) : ref;
  const entry = ctx.refs.get(refName);
  if (!entry) throw new Error(`click: unknown ref "${ref}". Run snapshot first to get refs.`);

  const { object } = await ctx.cdp.send<{ object: { objectId: string } }>("DOM.resolveNode", {
    backendNodeId: entry.backendDOMNodeId,
  });

  if (!object?.objectId) throw new Error(`click: could not resolve ref "${ref}" to DOM element`);

  const result = await ctx.cdp.send<{ result: { value: unknown }; exceptionDetails?: { text: string } }>(
    "Runtime.callFunctionOn",
    {
      objectId: object.objectId,
      functionDeclaration: `function() {
        this.scrollIntoView({ block: 'center' });
        this.click();
        return { success: true, tag: this.tagName, text: (this.textContent || '').slice(0, 100) };
      }`,
      returnByValue: true,
    }
  );

  if (result.exceptionDetails) throw new Error(`click: ${result.exceptionDetails.text}`);
  return result.result.value || { success: true };
}

async function clickBySelector(selector: string, ctx: ToolContext): Promise<unknown> {
  const result = await ctx.cdp.send<{ result: { value: unknown }; exceptionDetails?: { text: string } }>(
    "Runtime.evaluate",
    {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { error: 'element not found: ${serialize(selector)}' };
        el.scrollIntoView({ block: 'center' });
        el.click();
        return { success: true, tag: el.tagName, text: (el.textContent || '').slice(0, 100) };
      })()`,
      returnByValue: true,
    }
  );

  if (result.exceptionDetails) throw new Error(`click: ${result.exceptionDetails.text}`);
  const value = result.result.value as { error?: string; success?: boolean; tag?: string; text?: string };
  if (value?.error) throw new Error(value.error);
  return value || { success: true };
}

function serialize(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

registerTool(clickTool);
