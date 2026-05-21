import { TAB_GROUP_COLORS, FALLBACK_COLORS } from "@qweb/protocol";

const sessionGroups = new Map<string, number>();
let colorIndex = 0;

const attachedTabs = new Set<number>();

chrome.tabs.onRemoved.addListener((tabId) => {
  attachedTabs.delete(tabId);
});

chrome.debugger.onDetach.addListener(({ tabId }) => {
  if (tabId) attachedTabs.delete(tabId);
});

export async function groupTab(
  tabIds: number | number[],
  sessionName: string,
  groupTitle?: string
): Promise<void> {
  const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
  const existingGroup = sessionGroups.get(sessionName);

  if (existingGroup != null) {
    await chrome.tabs.group({ tabIds: ids, groupId: existingGroup });
    return;
  }

  const color = TAB_GROUP_COLORS[sessionName] ?? FALLBACK_COLORS[colorIndex++ % FALLBACK_COLORS.length];
  const title = groupTitle ?? sessionName;

  const groupId = await chrome.tabs.group({ tabIds: ids });
  await chrome.tabGroups.update(groupId, { title, color: color as chrome.tabGroups.ColorEnum, collapsed: false });
  sessionGroups.set(sessionName, groupId);
}

export function trackTab(tabId: number): void {
  attachedTabs.add(tabId);
}

export function untrackTab(tabId: number): void {
  attachedTabs.delete(tabId);
}

export function getAttachedTabs(): Set<number> {
  return attachedTabs;
}

export function clearSessionGroup(sessionName: string): void {
  sessionGroups.delete(sessionName);
}
