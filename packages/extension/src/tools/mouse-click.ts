import { registerTool, type ToolExecutor, type ToolContext } from "./index.js";

const mouseClickTool: ToolExecutor = {
  name: "mouse_click",
  async execute(params, ctx) {
    const selector = params.selector as string;
    if (!selector) throw new Error("mouse_click: selector is required");

    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    const objectId = await getObjectId(selector, ctx);

    // Scroll into view
    await ctx.cdp.send("Runtime.callFunctionOn", {
      objectId,
      functionDeclaration: `function() { this.scrollIntoView({ block: 'center', inline: 'center' }); }`,
    });

    // Get box model
    const boxModel = await ctx.cdp.send<{ model?: { content: number[] } }>("DOM.getBoxModel", { objectId });
    if (!boxModel.model || !boxModel.model.content || boxModel.model.content.length < 8) {
      throw new Error("mouse_click: element has no layout box (display:none / detached / zero-size)");
    }
    const [x0, y0, x1, y1, x2, y2, x3, y3] = boxModel.model.content;
    const cx = Math.round((x0 + x1 + x2 + x3) / 4);
    const cy = Math.round((y0 + y1 + y2 + y3) / 4);

    // Dispatch mouse events
    await ctx.cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: cx, y: cy, button: "none", buttons: 0 });
    await ctx.cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", buttons: 1, clickCount: 1 });
    await ctx.cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy, button: "left", buttons: 0, clickCount: 1 });

    const info = await ctx.cdp.send<{ result: { value: { tag: string; text: string } } }>("Runtime.callFunctionOn", {
      objectId,
      functionDeclaration: `function() { return { tag: this.tagName, text: (this.textContent || '').slice(0, 100) }; }`,
      returnByValue: true,
    });

    return {
      success: true,
      x: cx,
      y: cy,
      tag: info.result.value?.tag ?? "",
      text: info.result.value?.text ?? "",
    };
  },
};

async function getObjectId(selector: string, ctx: ToolContext): Promise<string> {
  if (ctx.refs.isRef(selector)) {
    const refName = selector.startsWith("@") ? selector.slice(1) : selector;
    const entry = ctx.refs.get(refName);
    if (!entry) throw new Error(`mouse_click: unknown ref "${selector}"`);
    const { object } = await ctx.cdp.send<{ object: { objectId: string } }>("DOM.resolveNode", {
      backendNodeId: entry.backendDOMNodeId,
    });
    if (!object?.objectId) throw new Error("mouse_click: could not resolve ref");
    return object.objectId;
  }

  const result = await ctx.cdp.send<{ result: { objectId?: string; subtype?: string } }>(
    "Runtime.evaluate",
    { expression: `document.querySelector(${JSON.stringify(selector)})`, returnByValue: false }
  );
  if (result.result.subtype === "null" || !result.result.objectId) {
    throw new Error(`mouse_click: element not found: ${selector}`);
  }
  return result.result.objectId;
}

registerTool(mouseClickTool);
