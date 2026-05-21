import { registerTool, getTabId, type ToolExecutor } from "./index.js";

const saveAsPdfTool: ToolExecutor = {
  name: "save_as_pdf",
  async execute(params, ctx) {
    await ctx.cdp.attach(await getTabId(params, ctx));

    const result = await ctx.cdp.send<{ data: string }>("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
    });

    return { success: true, data: result.data };
  },
};

registerTool(saveAsPdfTool);
