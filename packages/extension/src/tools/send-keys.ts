import { registerTool, getTabId } from "./index.js";

const KEY_MAP: Record<string, { code: string; key: string; text?: string }> = {
  Enter: { code: "Enter", key: "Enter", text: "\r" },
  Tab: { code: "Tab", key: "Tab", text: "\t" },
  Escape: { code: "Escape", key: "Escape" },
  Backspace: { code: "Backspace", key: "Backspace" },
  Delete: { code: "Delete", key: "Delete" },
  ArrowUp: { code: "ArrowUp", key: "ArrowUp" },
  ArrowDown: { code: "ArrowDown", key: "ArrowDown" },
  ArrowLeft: { code: "ArrowLeft", key: "ArrowLeft" },
  ArrowRight: { code: "ArrowRight", key: "ArrowRight" },
  PageUp: { code: "PageUp", key: "PageUp" },
  PageDown: { code: "PageDown", key: "PageDown" },
  Home: { code: "Home", key: "Home" },
  End: { code: "End", key: "End" },
  Space: { code: "Space", key: " ", text: " " },
};

registerTool({
  name: "send_keys",
  async execute(params, ctx) {
    const keys = params.keys as string;
    if (typeof keys !== "string" || !keys.trim()) throw new Error("send_keys: keys is required");

    await ctx.cdp.attach(await getTabId(params, ctx));

    const parts = keys.split("+");
    const keyName = parts[parts.length - 1];
    const modifiers =
      parts.length > 1
        ? parts.slice(0, -1).reduce((mod, m) => {
            if (m === "Control" || m === "Ctrl") mod += 2;
            if (m === "Alt") mod += 1;
            if (m === "Shift") mod += 8;
            if (m === "Meta" || m === "Command") mod += 4;
            return mod;
          }, 0)
        : 0;

    const keyDef = KEY_MAP[keyName] || { code: keyName, key: keyName.toLowerCase(), text: keyName.toLowerCase() };

    await ctx.cdp.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: keyDef.key,
      code: keyDef.code,
      text: keyDef.text,
      modifiers,
    });
    await ctx.cdp.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: keyDef.key,
      code: keyDef.code,
      modifiers,
    });

    return { success: true };
  },
});
