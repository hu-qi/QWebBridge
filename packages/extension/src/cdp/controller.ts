import { ERROR_CODES } from "@qweb/protocol";
import { ToolError } from "../tool-error.js";

export interface CDPTabSession {
  readonly tabId: number;
  readonly signal: AbortSignal;
  send<T>(method: string, params?: Record<string, unknown>): Promise<T>;
}

export const DEFAULT_MAX_CONCURRENT_TAB_OPERATIONS = 5;

export interface CDPControllerOptions {
  maxConcurrentTabOperations?: number;
}

interface SemaphoreWaiter {
  resolve: (release: () => void) => void;
  reject: (error: unknown) => void;
  signal: AbortSignal;
  onAbort: () => void;
}

interface TabLane {
  tail: Promise<void>;
  abortController: AbortController;
}

class Semaphore {
  private available: number;
  private waiters: SemaphoreWaiter[] = [];

  constructor(limit: number) {
    this.available = limit;
  }

  acquire(signal: AbortSignal): Promise<() => void> {
    throwIfAborted(signal);
    if (this.available > 0) {
      this.available -= 1;
      return Promise.resolve(this.createRelease());
    }

    return new Promise((resolve, reject) => {
      const waiter: SemaphoreWaiter = {
        resolve,
        reject,
        signal,
        onAbort: () => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          reject(getAbortReason(signal));
        },
      };
      signal.addEventListener("abort", waiter.onAbort, { once: true });
      this.waiters.push(waiter);
    });
  }

  private createRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;

      const next = this.waiters.shift();
      if (next) {
        next.signal.removeEventListener("abort", next.onAbort);
        next.resolve(this.createRelease());
      } else {
        this.available += 1;
      }
    };
  }
}

export class CDPController {
  private attachedTabs = new Set<number>();
  private closedTabs = new Set<number>();
  private fallbackTabId: number | null = null;
  private tabLanes = new Map<number, TabLane>();
  private readonly semaphore: Semaphore;

  constructor(options: CDPControllerOptions = {}) {
    const limit = options.maxConcurrentTabOperations ?? DEFAULT_MAX_CONCURRENT_TAB_OPERATIONS;
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("maxConcurrentTabOperations must be a positive integer");
    }
    this.semaphore = new Semaphore(limit);
  }

  async run<T>(tabId: number, operation: (tab: CDPTabSession) => Promise<T>): Promise<T> {
    if (this.closedTabs.has(tabId)) {
      throw new ToolError(ERROR_CODES.TAB_CLOSED, `Tab ${tabId} is closed.`);
    }
    return this.enqueue(tabId, async (signal) => {
      const release = await this.semaphore.acquire(signal);
      try {
        throwIfAborted(signal);
        await this.attach(tabId);
        throwIfAborted(signal);
        const tab: CDPTabSession = {
          tabId,
          signal,
          send: <R>(method: string, params?: Record<string, unknown>) =>
            this.sendToTab<R>(tabId, method, params, signal),
        };
        const result = await operation(tab);
        throwIfAborted(signal);
        return result;
      } finally {
        release();
      }
    });
  }

  async close(tabId: number): Promise<void> {
    this.closedTabs.add(tabId);
    this.cancelLane(tabId, new ToolError(ERROR_CODES.TAB_CLOSED, `Tab ${tabId} is closed.`));

    try {
      await chrome.debugger.detach({ tabId });
    } catch {
      // Chrome can close the tab before this cleanup runs.
    }
    this.attachedTabs.delete(tabId);
  }

  open(tabId: number): void {
    this.closedTabs.delete(tabId);
  }

  handleDetach(tabId: number): void {
    this.attachedTabs.delete(tabId);
    this.cancelLane(tabId, new ToolError(ERROR_CODES.OPERATION_ABORTED, `Debugger detached from tab ${tabId}.`));
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

    await chrome.debugger.attach({ tabId }, "1.3");
    this.attachedTabs.add(tabId);
  }

  private async sendToTab<T>(
    tabId: number,
    method: string,
    params: Record<string, unknown> | undefined,
    signal: AbortSignal,
  ): Promise<T> {
    throwIfAborted(signal);
    try {
      const result = (await chrome.debugger.sendCommand({ tabId }, method, params as Record<string, never>)) as T;
      throwIfAborted(signal);
      return result;
    } catch (error: unknown) {
      throwIfAborted(signal);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Cannot find context") || message.includes("Execution context was destroyed")) {
        await this.ensureExecutionContext(tabId);
        throwIfAborted(signal);
        return (await chrome.debugger.sendCommand({ tabId }, method, params as Record<string, never>)) as T;
      }
      throw error;
    }
  }

  private enqueue<T>(tabId: number, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    let lane = this.tabLanes.get(tabId);
    if (!lane) {
      lane = {
        tail: Promise.resolve(),
        abortController: new AbortController(),
      };
      this.tabLanes.set(tabId, lane);
    }

    const run = () => {
      throwIfAborted(lane!.abortController.signal);
      return operation(lane!.abortController.signal);
    };
    const result = lane.tail.then(run, run);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    lane.tail = tail;

    return result.finally(() => {
      if (this.tabLanes.get(tabId) === lane && lane!.tail === tail) {
        this.tabLanes.delete(tabId);
      }
    });
  }

  private cancelLane(tabId: number, error: ToolError): void {
    const lane = this.tabLanes.get(tabId);
    if (!lane) return;
    this.tabLanes.delete(tabId);
    lane.abortController.abort(error);
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

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw getAbortReason(signal);
}

function getAbortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new ToolError(ERROR_CODES.OPERATION_ABORTED, "Operation was aborted.");
}
