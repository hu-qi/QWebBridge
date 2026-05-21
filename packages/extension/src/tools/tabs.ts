import { registerTool } from "./index.js";
import { untrackTab, clearSessionGroup } from "../tab-manager.js";

registerTool({
  name: "find_tab",
  async execute(params) {
    const url_contains = params.url_contains as string;
    if (!url_contains) throw new Error("find_tab: url_contains is required");

    const allTabs = await chrome.tabs.query({});
    for (const tab of allTabs) {
      if (tab.url?.includes(url_contains)) {
        return { tabId: tab.id!, url: tab.url, title: tab.title || "" };
      }
    }
    throw new Error(`find_tab: no tab found matching "${url_contains}"`);
  },
});

registerTool({
  name: "list_tabs",
  async execute(params) {
    const tabIds = params._tabIds as number[] | undefined;
    if (Array.isArray(tabIds) && tabIds.length > 0) {
      const tabs = await Promise.all(tabIds.map((id) => chrome.tabs.get(id).catch(() => null)));
      return {
        tabs: tabs.filter(Boolean).map((t) => ({
          tabId: t!.id!,
          url: t!.url || "",
          title: t!.title || "",
          active: t!.active,
        })),
      };
    }
    const allTabs = await chrome.tabs.query({});
    return {
      tabs: allTabs.map((t) => ({
        tabId: t.id!,
        url: t.url || "",
        title: t.title || "",
        active: t.active,
      })),
    };
  },
});

registerTool({
  name: "close_tab",
  async execute(params, ctx) {
    const tabId = params._tabId as number | undefined;
    if (tabId == null) return { success: true };

    try {
      await ctx.cdp.detach(tabId);
    } catch {}
    untrackTab(tabId);
    await chrome.tabs.remove(tabId);
    return { success: true };
  },
});

registerTool({
  name: "close_session",
  async execute(params, ctx) {
    const tabIds = params._tabIds as number[] | undefined;
    const sessionName = params._session as string | undefined;

    if (Array.isArray(tabIds)) {
      for (const tabId of tabIds) {
        try {
          await ctx.cdp.detach(tabId);
        } catch {}
        untrackTab(tabId);
        await chrome.tabs.remove(tabId).catch(() => {});
      }
    }
    if (sessionName) {
      clearSessionGroup(sessionName);
    }
    return { success: true };
  },
});
