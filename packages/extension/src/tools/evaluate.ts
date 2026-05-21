import { registerTool, getTabId, type ToolExecutor } from "./index.js";

const evaluateTool: ToolExecutor = {
  name: "evaluate",
  async execute(params, ctx) {
    const code = params.code as string;
    if (!code) throw new Error("evaluate: code is required");

    await ctx.cdp.attach(await getTabId(params, ctx));

    const result = await ctx.cdp.send<{ result: { value: unknown }; exceptionDetails?: { text: string } }>(
      "Runtime.evaluate",
      {
        expression: code,
        returnByValue: true,
        awaitPromise: true,
      }
    );

    if (result.exceptionDetails) {
      throw new Error(`evaluate: ${result.exceptionDetails.text}`);
    }

    return result.result.value;
  },
};

registerTool(evaluateTool);
