export class CDPController {
  private attachedTabs = new Set<number>();
  private currentTabId: number | null = null;
  private fallbackTabId: number | null = null;
  private commandQueue: Promise<unknown> = Promise.resolve();

  async attach(tabId: number): Promise<void> {
    if (this.attachedTabs.has(tabId)) {
      this.currentTabId = tabId;
      return;
    }

    try {
      await chrome.debugger.detach({ tabId });
    } catch {
      // Tab may not be attached
    }

    await chrome.debugger.attach({ tabId }, "1.3");
    this.attachedTabs.add(tabId);
    this.currentTabId = tabId;
  }

  async detach(tabId: number): Promise<void> {
    try {
      await chrome.debugger.detach({ tabId });
    } catch {
      // Tab may already be detached
    }
    this.attachedTabs.delete(tabId);
    if (this.currentTabId === tabId) {
      this.currentTabId = null;
    }
  }

  async send<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const tabId = this.currentTabId;
    if (tabId === null) {
      throw new Error("No tab attached. Call attach(tabId) first.");
    }
    try {
      return (await chrome.debugger.sendCommand({ tabId }, method, params as Record<string, never>)) as T;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Cannot find context") || msg.includes("Execution context was destroyed")) {
        await this.ensureExecutionContext(tabId);
        return (await chrome.debugger.sendCommand({ tabId }, method, params as Record<string, never>)) as T;
      }
      throw e;
    }
  }

  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    return this.enqueue(operation);
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.commandQueue.then(operation, operation);
    this.commandQueue = next.catch(() => undefined);
    return next;
  }

  private async ensureExecutionContext(tabId: number): Promise<void> {
    try {
      await chrome.debugger.sendCommand({ tabId }, "Runtime.enable", {});
      await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", { expression: "1", returnByValue: true });
    } catch {
      // Context may still be initializing
    }
  }

  getCurrentTabId(): number | null {
    return this.currentTabId;
  }

  setFallbackTab(tabId: number): void {
    this.fallbackTabId = tabId;
  }

  async getActiveTab(): Promise<chrome.tabs.Tab> {
    // Try current attached tab first
    if (this.currentTabId !== null) {
      try {
        const tab = await chrome.tabs.get(this.currentTabId);
        if (tab) return tab;
      } catch {
        this.attachedTabs.delete(this.currentTabId);
        this.currentTabId = null;
      }
    }

    // Try fallback tab
    if (this.fallbackTabId !== null) {
      try {
        const tab = await chrome.tabs.get(this.fallbackTabId);
        if (tab) return tab;
      } catch {
        this.fallbackTabId = null;
      }
    }

    // Query active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("No active tab found");
    }
    this.fallbackTabId = tab.id;
    return tab;
  }
}
