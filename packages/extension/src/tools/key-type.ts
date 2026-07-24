import { registerTool, getTabId } from "./index.js";

registerTool({
  name: "key_type",
  async execute(params, ctx) {
    const text = params.text as string;
    if (typeof text !== "string") throw new Error("key_type: text is required");

    const tabId = await getTabId(params, ctx);
    return ctx.cdp.run(tabId, async (tab) => {
      for (const char of text) {
        await tab.send("Input.dispatchKeyEvent", {
          type: "char",
          text: char,
          unmodifiedText: char,
          key: char,
        });
      }

      return { success: true };
    });
  },
});
