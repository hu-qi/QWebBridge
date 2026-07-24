import { registerTool, getTabId, type ToolExecutor } from "./index.js";

const saveAsPdfTool: ToolExecutor = {
  name: "save_as_pdf",
  async execute(params, ctx) {
    const tabId = await getTabId(params, ctx);
    return ctx.cdp.run(tabId, async (tab) => {
      const result = await tab.send<{ data: string }>("Page.printToPDF", {
        printBackground: true,
        preferCSSPageSize: true,
      });

      return { success: true, data: result.data };
    });
  },
};

registerTool(saveAsPdfTool);
