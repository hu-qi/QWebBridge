import { FALLBACK_COLORS } from "@qweb/protocol";

const PREDEFINED_COLORS: Record<string, string> = {
  twitter: "blue",
  xhs: "red",
  zhihu: "blue",
  worldquant: "purple",
};

const sessionGroups = new Map<string, number>();
let colorIndex = 0;

const attachedTabs = new Set<number>();

chrome.tabs.onRemoved.addListener((tabId) => {
  attachedTabs.delete(tabId);
});

chrome.debugger.onDetach.addListener(({ tabId }) => {
  if (tabId) attachedTabs.delete(tabId);
});

// Listen for tab group removal to clean up our map
chrome.tabGroups.onRemoved.addListener((group) => {
  for (const [session, gid] of sessionGroups) {
    if (gid === group.id) {
      sessionGroups.delete(session);
      break;
    }
  }
});

function getGroupTitle(sessionName: string): string {
  return `agent:${sessionName}`;
}

function pickColor(sessionName: string): string {
  return PREDEFINED_COLORS[sessionName] ?? FALLBACK_COLORS[colorIndex++ % FALLBACK_COLORS.length];
}

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

  // Recover existing group by title (survives extension restart)
  const title = getGroupTitle(sessionName);
  const existing = await chrome.tabGroups.query({ title });
  if (existing.length > 0) {
    const gid = existing[0].id;
    await chrome.tabs.group({ tabIds: ids, groupId: gid });
    sessionGroups.set(sessionName, gid);
    return;
  }

  const color = pickColor(sessionName);
  const displayTitle = groupTitle ?? title;

  const groupId = await chrome.tabs.group({ tabIds: ids });
  await chrome.tabGroups.update(groupId, { title: displayTitle, color: color as chrome.tabGroups.ColorEnum, collapsed: false });
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
