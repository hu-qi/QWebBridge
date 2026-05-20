import { registerTool, type ToolExecutor } from "./index.js";
import { groupTab, trackTab } from "../tab-manager.js";

const navigateTool: ToolExecutor = {
  name: "navigate",
  async execute(params, ctx) {
    const url = params.url as string;
    if (!url) throw new Error("navigate: url is required");

    const newTab = params.newTab as boolean | undefined;
    const session = params._session as string | undefined;
    const groupTitle = params.group_title as string | undefined;

    if (newTab) {
      const tab = await chrome.tabs.create({ url, active: true });
      if (session) {
        await groupTab(tab.id!, session, groupTitle);
      }
      await ctx.cdp.attach(tab.id!);
      trackTab(tab.id!);
      await waitForLoad(tab.id!);
      return { success: true, url, tabId: tab.id! };
    }

    const tab = await ctx.cdp.getActiveTab();
    await ctx.cdp.attach(tab.id!);
    trackTab(tab.id!);
    await ctx.cdp.send("Page.navigate", { url });
    await waitForLoad(tab.id!);
    return { success: true, url, tabId: tab.id! };
  },
};

async function waitForLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const handler = (tabId2: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (tabId2 === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(handler);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(handler);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handler);
      resolve();
    }, 30_000);
  });
}

registerTool(navigateTool);
