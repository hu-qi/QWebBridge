import { registerTool, getTabId, type ToolExecutor } from "./index.js";

interface ToolCtx {
  cdp: { send: <T>(method: string, params?: Record<string, unknown>) => Promise<T> };
  refs: { isRef: (s: string) => boolean; get: (s: string) => { backendDOMNodeId: number } | undefined };
}

const mouseClickTool: ToolExecutor = {
  name: "mouse_click",
  async execute(params, ctx) {
    const selector = params.selector as string;
    if (!selector) throw new Error("mouse_click: selector is required");

    await ctx.cdp.attach(await getTabId(params, ctx));

    let cx: number, cy: number, tag: string, text: string;

    if (ctx.refs.isRef(selector)) {
      ({ cx, cy, tag, text } = await getCoordsByRef(selector, ctx));
    } else {
      ({ cx, cy, tag, text } = await getCoordsBySelector(selector, ctx));
    }

    const dispatchScript = `(() => {
      const el = document.elementFromPoint(${cx}, ${cy});
      if (!el) return { error: 'no element at (${cx}, ${cy})' };
      [ 'mousemove', 'mousedown', 'mouseup', 'click' ].forEach(type => {
        el.dispatchEvent(new MouseEvent(type, {
          bubbles: true, cancelable: true, view: window,
          clientX: ${cx}, clientY: ${cy}, button: 0, buttons: type === 'mousedown' ? 1 : 0
        }));
      });
      return { success: true };
    })()`;

    const result = await ctx.cdp.send<{ result: { value: unknown }; exceptionDetails?: { text: string } }>(
      "Runtime.evaluate",
      { expression: dispatchScript, returnByValue: true },
    );
    if (result.exceptionDetails) throw new Error(`mouse_click: ${result.exceptionDetails.text}`);
    const val = result.result.value as { error?: string; success?: boolean };
    if (val.error) throw new Error(`mouse_click: ${val.error}`);

    return { success: true, x: cx, y: cy, tag, text };
  },
};

async function getCoordsByRef(
  ref: string,
  ctx: ToolCtx,
): Promise<{ cx: number; cy: number; tag: string; text: string }> {
  const refName = ref.startsWith("@") ? ref.slice(1) : ref;
  const entry = ctx.refs.get(refName);
  if (!entry) throw new Error(`mouse_click: unknown ref "${ref}"`);

  const evalCtx = await ctx.cdp.send<{ executionContextId?: number }>("Runtime.evaluate", {
    expression: "1",
    returnByValue: true,
  });
  const { object } = await ctx.cdp.send<{ object: { objectId: string } }>("DOM.resolveNode", {
    backendNodeId: entry.backendDOMNodeId,
    executionContextId: evalCtx.executionContextId ?? 1,
  });
  if (!object?.objectId) throw new Error("mouse_click: could not resolve ref");

  const rect = await ctx.cdp.send<{
    result: { value: { x: number; y: number; w: number; h: number; tag: string; text: string } };
    exceptionDetails?: { text: string };
  }>("Runtime.callFunctionOn", {
    objectId: object.objectId,
    functionDeclaration: `function() {
        const r = this.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, tag: this.tagName, text: (this.textContent || '').slice(0, 100) };
      }`,
    returnByValue: true,
  });
  if (rect.exceptionDetails) throw new Error(`mouse_click: ${rect.exceptionDetails.text}`);
  const { x, y, w, h, tag, text } = rect.result.value;
  if (w === 0 && h === 0) throw new Error("mouse_click: element has no layout box");

  return { cx: Math.round(x + w / 2), cy: Math.round(y + h / 2), tag, text };
}

async function getCoordsBySelector(
  selector: string,
  ctx: Pick<ToolCtx, "cdp">,
): Promise<{ cx: number; cy: number; tag: string; text: string }> {
  const escaped = JSON.stringify(selector);
  const result = await ctx.cdp.send<{
    result: { value: { x: number; y: number; w: number; h: number; tag: string; text: string } };
    exceptionDetails?: { text: string };
  }>("Runtime.evaluate", {
    expression: `(() => {
        const el = document.querySelector(${escaped});
        if (!el) return { error: 'element not found' };
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, tag: el.tagName, text: (el.textContent || '').slice(0, 100) };
      })()`,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(`mouse_click: ${result.exceptionDetails.text}`);
  const val = result.result.value as {
    error?: string;
    x: number;
    y: number;
    w: number;
    h: number;
    tag: string;
    text: string;
  };
  if (val.error) throw new Error(`mouse_click: ${val.error}`);
  if (!val.x || !val.y || val.w === 0 || val.h === 0) throw new Error("mouse_click: element has no layout box");

  return {
    cx: Math.round(val.x + val.w / 2),
    cy: Math.round(val.y + val.h / 2),
    tag: val.tag ?? "",
    text: val.text ?? "",
  };
}

registerTool(mouseClickTool);
