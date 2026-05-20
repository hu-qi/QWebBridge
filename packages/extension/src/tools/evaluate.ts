import { registerTool, type ToolExecutor } from "./index.js";

const evaluateTool: ToolExecutor = {
  name: "evaluate",
  async execute(params, ctx) {
    const code = params.code as string;
    if (!code) throw new Error("evaluate: code is required");

    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);

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
