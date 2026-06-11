import { registerTool, getTabId, type ToolExecutor } from "./index.js";

const streamingStatusTool: ToolExecutor = {
  name: "streaming_status",
  async execute(params, ctx) {
    await ctx.cdp.attach(await getTabId(params, ctx));
    const selector =
      (params.selector as string | undefined) ||
      "[data-testid='stop-button'], button[aria-label*='Stop'], button[aria-label*='停止']";

    const result = await ctx.cdp.send<{
      result: {
        value: { success: boolean; isStreaming: boolean; hasPendingAuth: boolean; url: string; title: string };
      };
      exceptionDetails?: { text: string };
    }>("Runtime.evaluate", {
      expression: `(() => {
        const stopSelector = ${JSON.stringify(selector)};
        const isStreaming = !!document.querySelector(stopSelector);
        const authButtonText = ['Create File', 'Deny', 'Allow', 'Authorize', '授权', '允许', '拒绝'];
        const hasPendingAuth = Array.from(document.querySelectorAll('button'))
          .some((button) => authButtonText.includes((button.textContent || '').trim()));
        return {
          success: true,
          isStreaming,
          hasPendingAuth,
          url: location.href,
          title: document.title,
        };
      })()`,
      returnByValue: true,
    });

    if (result.exceptionDetails) throw new Error(`streaming_status: ${result.exceptionDetails.text}`);
    return result.result.value;
  },
};

registerTool(streamingStatusTool);
