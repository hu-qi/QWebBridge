import { registerTool, type ToolContext } from "./index.js";

registerTool({
  name: "upload",
  async execute(params, ctx) {
    const selector = params.selector as string;
    const filePath = params.filePath as string | undefined;
    const files = params.files as string[] | undefined;

    if (!selector) throw new Error("upload: selector is required");
    const paths = files ?? (filePath ? [filePath] : []);
    if (paths.length === 0) throw new Error("upload: filePath or files is required");

    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    const objectId = await getUploadObjectId(selector, ctx);
    const nodeIdResult = await ctx.cdp.send<{ nodeId: number }>("DOM.requestNode", { objectId });
    await ctx.cdp.send("DOM.setFileInputFiles", {
      nodeId: nodeIdResult.nodeId,
      files: paths,
    });

    return { success: true };
  },
});

async function getUploadObjectId(selector: string, ctx: ToolContext): Promise<string> {
  if (ctx.refs.isRef(selector)) {
    const refName = selector.startsWith("@") ? selector.slice(1) : selector;
    const entry = ctx.refs.get(refName);
    if (!entry) throw new Error(`upload: unknown ref "${selector}"`);
    const { object } = await ctx.cdp.send<{ object: { objectId: string } }>("DOM.resolveNode", {
      backendNodeId: entry.backendDOMNodeId,
    });
    if (!object?.objectId) throw new Error("upload: could not resolve ref");
    return object.objectId;
  }

  const result = await ctx.cdp.send<{ result: { objectId?: string; subtype?: string } }>(
    "Runtime.evaluate",
    { expression: `document.querySelector(${JSON.stringify(selector)})`, returnByValue: false }
  );
  if (result.result.subtype === "null" || !result.result.objectId) {
    throw new Error(`upload: element not found: ${selector}`);
  }
  return result.result.objectId;
}
