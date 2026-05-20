import { registerTool, type ToolExecutor, type ToolContext } from "./index.js";

function fillScript(targetExpr: string, value: string): string {
  const n = JSON.stringify(value);
  return `
    const __target = ${targetExpr};
    __target.focus();
    if (__target.isContentEditable) {
      const __sel = window.getSelection();
      if (__sel) {
        const __range = document.createRange();
        __range.selectNodeContents(__target);
        __sel.removeAllRanges();
        __sel.addRange(__range);
      }
      let __inserted = false;
      try {
        __inserted = document.execCommand('insertText', false, ${n});
      } catch (_e) {
        __inserted = false;
      }
      if (!__inserted) {
        __target.textContent = ${n};
        __target.dispatchEvent(new InputEvent('input', {
          inputType: 'insertText',
          data: ${n},
          bubbles: true,
        }));
      }
      return { success: true, tag: __target.tagName, mode: 'contenteditable' };
    }
    const __nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;
    if (__nativeSetter) {
      __nativeSetter.call(__target, ${n});
    } else {
      __target.value = ${n};
    }
    __target.dispatchEvent(new Event('input', { bubbles: true }));
    __target.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true, tag: __target.tagName, mode: 'value' };
  `;
}

const fillTool: ToolExecutor = {
  name: "fill",
  async execute(params, ctx) {
    const selector = params.selector as string;
    const value = params.value as string;
    if (!selector) throw new Error("fill: selector is required");
    if (value == null) throw new Error("fill: value is required");

    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    if (ctx.refs.isRef(selector)) {
      const refName = selector.startsWith("@") ? selector.slice(1) : selector;
      const entry = ctx.refs.get(refName);
      if (!entry) throw new Error(`fill: unknown ref "${selector}"`);

      const { object } = await ctx.cdp.send<{ object: { objectId: string } }>("DOM.resolveNode", {
        backendNodeId: entry.backendDOMNodeId,
      });
      if (!object?.objectId) throw new Error("fill: could not resolve ref");

      const result = await ctx.cdp.send<{ result: { value: unknown }; exceptionDetails?: { text: string } }>(
        "Runtime.callFunctionOn",
        {
          objectId: object.objectId,
          functionDeclaration: `function() { ${fillScript("this", value)} }`,
          returnByValue: true,
        }
      );
      if (result.exceptionDetails) throw new Error(`fill: ${result.exceptionDetails.text}`);
      return result.result.value || { success: true };
    } else {
      const result = await ctx.cdp.send<{ result: { value: unknown }; exceptionDetails?: { text: string } }>(
        "Runtime.evaluate",
        {
          expression: `(() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { error: 'element not found: ${selector}' };
            ${fillScript("el", value)}
          })()`,
          returnByValue: true,
        }
      );
      if (result.exceptionDetails) throw new Error(`fill: ${result.exceptionDetails.text}`);
      const val = result.result.value as { error?: string; success?: boolean; tag?: string; mode?: string };
      if (val?.error) throw new Error(val.error);
      return val || { success: true };
    }
  },
};

registerTool(fillTool);
