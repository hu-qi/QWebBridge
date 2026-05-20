import { registerTool, type ToolExecutor } from "./index.js";

const saveAsPdfTool: ToolExecutor = {
  name: "save_as_pdf",
  async execute(params, ctx) {
    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

    const result = await ctx.cdp.send<{ data: string }>("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
    });

    return { success: true, data: result.data };
  },
};

registerTool(saveAsPdfTool);
