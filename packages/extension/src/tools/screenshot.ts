import { registerTool, getTabId, type ToolExecutor } from "./index.js";

const screenshotTool: ToolExecutor = {
  name: "screenshot",
  async execute(params, ctx) {
    await ctx.cdp.attach(await getTabId(params, ctx));

    const format = (params.format as string) || "png";
    const fullPage = params.fullPage as boolean | undefined;

    const result = await ctx.cdp.send<{ data: string }>("Page.captureScreenshot", {
      format: format as "png" | "jpeg" | "webp",
      quality: params.quality as number | undefined,
      captureBeyondViewport: fullPage ?? false,
      fromSurface: true,
    });

    return { success: true, data: result.data };
  },
};

registerTool(screenshotTool);
