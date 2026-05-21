import { registerTool, getTabId } from "./index.js";

registerTool({
  name: "key_type",
  async execute(params, ctx) {
    const text = params.text as string;
    if (typeof text !== "string") throw new Error("key_type: text is required");

    await ctx.cdp.attach(await getTabId(params, ctx));

    for (const char of text) {
      await ctx.cdp.send("Input.dispatchKeyEvent", {
        type: "char",
        text: char,
        unmodifiedText: char,
        key: char,
      });
    }

    return { success: true };
  },
});
