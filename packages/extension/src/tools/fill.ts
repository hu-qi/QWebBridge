import { registerTool, getTabId, type ToolExecutor } from "./index.js";

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
      }
      __target.dispatchEvent(new InputEvent('input', {
        inputType: 'insertText',
        data: ${n},
        bubbles: true,
        composed: true,
      }));
      __target.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, tag: __target.tagName, mode: 'contenteditable' };
    }
    const __proto = __target.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const __nativeSetter = Object.getOwnPropertyDescriptor(__proto, 'value')?.set;
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

function submitScript(targetExpr: string): string {
  return `
    const __submitTarget = ${targetExpr};
    const __keyboardOptions = {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
      composed: true,
    };
    __submitTarget.dispatchEvent(new KeyboardEvent('keydown', __keyboardOptions));
    __submitTarget.dispatchEvent(new KeyboardEvent('keypress', __keyboardOptions));
    __submitTarget.dispatchEvent(new KeyboardEvent('keyup', __keyboardOptions));
  `;
}

const fillTool: ToolExecutor = {
  name: "fill",
  async execute(params, ctx) {
    const selector = params.selector as string;
    const value = params.value as string;
    const submit = params.submit === true;
    if (!selector) throw new Error("fill: selector is required");
    if (value == null) throw new Error("fill: value is required");

    await ctx.cdp.attach(await getTabId(params, ctx));

    if (ctx.refs.isRef(selector)) {
      const refName = selector.startsWith("@") ? selector.slice(1) : selector;
      const entry = ctx.refs.get(refName);
      if (!entry) throw new Error(`fill: unknown ref "${selector}"`);

      const evalCtx = await ctx.cdp.send<{ executionContextId?: number }>("Runtime.evaluate", {
        expression: "1",
        returnByValue: true,
      });
      const { object } = await ctx.cdp.send<{ object: { objectId: string } }>("DOM.resolveNode", {
        backendNodeId: entry.backendDOMNodeId,
        executionContextId: evalCtx.executionContextId ?? 1,
      });
      if (!object?.objectId) throw new Error("fill: could not resolve ref");

      const result = await ctx.cdp.send<{ result: { value: unknown }; exceptionDetails?: { text: string } }>(
        "Runtime.callFunctionOn",
        {
          objectId: object.objectId,
          functionDeclaration: `function() {
            const __result = (() => { ${fillScript("this", value)} })();
            ${submit ? submitScript("this") : ""}
            return { ...__result, submitted: ${JSON.stringify(submit)} };
          }`,
          returnByValue: true,
        },
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
            const result = (() => { ${fillScript("el", value)} })();
            ${submit ? submitScript("el") : ""}
            return { ...result, submitted: ${JSON.stringify(submit)} };
          })()`,
          returnByValue: true,
        },
      );
      if (result.exceptionDetails) throw new Error(`fill: ${result.exceptionDetails.text}`);
      const val = result.result.value as { error?: string; success?: boolean; tag?: string; mode?: string };
      if (val?.error) throw new Error(val.error);
      return val || { success: true };
    }
  },
};

registerTool(fillTool);
