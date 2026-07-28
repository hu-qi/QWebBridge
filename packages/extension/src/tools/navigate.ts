import { registerTool, getTabId, type ToolExecutor } from "./index.js";
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
      ctx.cdp.open(tab.id!);
      const agentSession = session || "default";
      await groupTab(tab.id!, agentSession, groupTitle);
      return ctx.cdp.run(tab.id!, async () => {
        trackTab(tab.id!);
        await waitForLoad(tab.id!);
        return { success: true, url, tabId: tab.id! };
      });
    }

    const tabId = await getTabId(params, ctx);
    return ctx.cdp.run(tabId, async (tab) => {
      trackTab(tabId);
      await tab.send("Page.navigate", { url });
      ctx.refs.clear(tabId);
      await waitForLoad(tabId);
      return { success: true, url, tabId };
    });
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
