export interface CDPTabSession {
  readonly tabId: number;
  send<T>(method: string, params?: Record<string, unknown>): Promise<T>;
}

export class CDPController {
  private attachedTabs = new Set<number>();
  private fallbackTabId: number | null = null;
  private tabQueues = new Map<number, Promise<void>>();

  async run<T>(tabId: number, operation: (tab: CDPTabSession) => Promise<T>): Promise<T> {
    return this.enqueue(tabId, async () => {
      await this.attach(tabId);
      const tab: CDPTabSession = {
        tabId,
        send: <R>(method: string, params?: Record<string, unknown>) => this.sendToTab<R>(tabId, method, params),
      };
      return operation(tab);
    });
  }

  async detach(tabId: number): Promise<void> {
    return this.enqueue(tabId, async () => {
      try {
        await chrome.debugger.detach({ tabId });
      } catch {
        // Chrome can detach a tab before the cleanup event runs.
      }
      this.attachedTabs.delete(tabId);
    });
  }

  setFallbackTab(tabId: number): void {
    this.fallbackTabId = tabId;
  }

  async getActiveTab(): Promise<chrome.tabs.Tab> {
    if (this.fallbackTabId !== null) {
      try {
        const tab = await chrome.tabs.get(this.fallbackTabId);
        if (tab) return tab;
      } catch {
        this.fallbackTabId = null;
      }
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (typeof tab?.id !== "number") {
      throw new Error("No active tab found");
    }
    this.fallbackTabId = tab.id;
    return tab;
  }

  private async attach(tabId: number): Promise<void> {
    if (this.attachedTabs.has(tabId)) return;

    try {
      await chrome.debugger.detach({ tabId });
    } catch {
      // The tab can start without a debugger connection.
    }

    await chrome.debugger.attach({ tabId }, "1.3");
    this.attachedTabs.add(tabId);
  }

  private async sendToTab<T>(tabId: number, method: string, params?: Record<string, unknown>): Promise<T> {
    try {
      return (await chrome.debugger.sendCommand({ tabId }, method, params as Record<string, never>)) as T;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Cannot find context") || message.includes("Execution context was destroyed")) {
        await this.ensureExecutionContext(tabId);
        return (await chrome.debugger.sendCommand({ tabId }, method, params as Record<string, never>)) as T;
      }
      throw error;
    }
  }

  private enqueue<T>(tabId: number, operation: () => Promise<T>): Promise<T> {
    const previous = this.tabQueues.get(tabId) ?? Promise.resolve();
    const result = previous.then(operation, operation);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.tabQueues.set(tabId, tail);

    return result.finally(() => {
      if (this.tabQueues.get(tabId) === tail) {
        this.tabQueues.delete(tabId);
      }
    });
  }

  private async ensureExecutionContext(tabId: number): Promise<void> {
    try {
      await chrome.debugger.sendCommand({ tabId }, "Runtime.enable", {});
      await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", { expression: "1", returnByValue: true });
    } catch {
      // Chrome can still initialize the execution context.
    }
  }
}
