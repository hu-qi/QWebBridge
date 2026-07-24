import { ERROR_CODES, type ErrorCode } from "@qweb/protocol";
import { ToolError } from "./tool-error.js";

interface RefEntry {
  backendDOMNodeId: number;
}

export interface ResolvedRef extends RefEntry {
  tabId: number;
}

interface OpaqueRefEntry extends ResolvedRef {
  token: string;
}

interface RefStoreOptions {
  runtimePrefix?: string;
  createId?: () => string;
  maxTombstones?: number;
}

interface RefTombstone {
  code: ErrorCode;
  tabId: number;
}

const OPAQUE_REF_PATTERN = /^@qref_v1_([a-zA-Z0-9-]+)_([a-zA-Z0-9-]+)$/;

export class RefStore {
  private refsByTab = new Map<number, Map<string, RefEntry>>();
  private opaqueRefs = new Map<string, OpaqueRefEntry>();
  private opaqueRefsByTab = new Map<number, Set<string>>();
  private tombstones = new Map<string, RefTombstone>();
  private readonly runtimePrefix: string;
  private readonly createId: () => string;
  private readonly maxTombstones: number;

  constructor(options: RefStoreOptions = {}) {
    this.runtimePrefix = options.runtimePrefix ?? crypto.randomUUID();
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.maxTombstones = options.maxTombstones ?? 4096;
  }

  issue(tabId: number, backendDOMNodeId: number): string {
    const token = `@qref_v1_${this.runtimePrefix}_${this.createId()}`;
    this.opaqueRefs.set(token, { token, tabId, backendDOMNodeId });

    let tabRefs = this.opaqueRefsByTab.get(tabId);
    if (!tabRefs) {
      tabRefs = new Set();
      this.opaqueRefsByTab.set(tabId, tabRefs);
    }
    tabRefs.add(token);
    return token;
  }

  resolve(ref: string, requestedTabId?: number): ResolvedRef | undefined {
    const tokenParts = OPAQUE_REF_PATTERN.exec(ref);
    if (ref.startsWith("@qref") && !tokenParts) {
      throw new ToolError(ERROR_CODES.INVALID_REF, `Invalid ref "${ref}".`);
    }
    if (tokenParts && tokenParts[1] !== this.runtimePrefix) {
      throw new ToolError(ERROR_CODES.STALE_REF, "Ref belongs to an earlier service worker instance.");
    }

    const tombstone = this.tombstones.get(ref);
    if (tombstone) {
      throw new ToolError(tombstone.code, this.getTombstoneMessage(tombstone.code));
    }

    const entry = this.opaqueRefs.get(ref);
    if (!entry) {
      if (tokenParts) {
        throw new ToolError(ERROR_CODES.UNKNOWN_REF, `Unknown ref "${ref}".`);
      }
      return undefined;
    }
    if (requestedTabId !== undefined && requestedTabId !== entry.tabId) {
      throw new ToolError(
        ERROR_CODES.REF_TAB_MISMATCH,
        `Ref belongs to tab ${entry.tabId}, but tab ${requestedTabId} was requested.`,
      );
    }
    return {
      tabId: entry.tabId,
      backendDOMNodeId: entry.backendDOMNodeId,
    };
  }

  beginSnapshot(tabId: number): void {
    this.refsByTab.delete(tabId);
    this.invalidateOpaqueRefs(tabId, ERROR_CODES.STALE_REF);
  }

  set(tabId: number, ref: string, backendDOMNodeId: number): void {
    let refs = this.refsByTab.get(tabId);
    if (!refs) {
      refs = new Map<string, RefEntry>();
      this.refsByTab.set(tabId, refs);
    }
    refs.set(ref, { backendDOMNodeId });
  }

  get(tabId: number, ref: string): RefEntry | undefined {
    return this.refsByTab.get(tabId)?.get(ref);
  }

  resolveRef(ref: string): string {
    return ref.startsWith("@") ? ref.slice(1) : ref;
  }

  isRef(value: string): boolean {
    return value.startsWith("@qref") || /^@?e\d+$/.test(value);
  }

  clear(tabId: number): void {
    this.refsByTab.delete(tabId);
    this.invalidateOpaqueRefs(tabId, ERROR_CODES.STALE_REF);
  }

  close(tabId: number): void {
    this.refsByTab.delete(tabId);
    this.invalidateOpaqueRefs(tabId, ERROR_CODES.TAB_CLOSED);
    for (const tombstone of this.tombstones.values()) {
      if (tombstone.tabId === tabId) tombstone.code = ERROR_CODES.TAB_CLOSED;
    }
  }

  markDetached(ref: string): void {
    const entry = this.opaqueRefs.get(ref);
    if (!entry) return;
    this.opaqueRefs.delete(ref);
    const tabRefs = this.opaqueRefsByTab.get(entry.tabId);
    tabRefs?.delete(ref);
    if (tabRefs?.size === 0) this.opaqueRefsByTab.delete(entry.tabId);
    this.addTombstone(ref, ERROR_CODES.NODE_DETACHED, entry.tabId);
  }

  rejectDetached(ref: string): never {
    this.markDetached(ref);
    throw new ToolError(ERROR_CODES.NODE_DETACHED, `The DOM node for ref "${ref}" is detached.`);
  }

  get size(): number {
    let size = 0;
    for (const refs of this.refsByTab.values()) {
      size += refs.size;
    }
    return size + this.opaqueRefs.size;
  }

  private invalidateOpaqueRefs(tabId: number, code: ErrorCode): void {
    const tokens = this.opaqueRefsByTab.get(tabId);
    if (tokens) {
      for (const token of tokens) {
        this.opaqueRefs.delete(token);
        this.addTombstone(token, code, tabId);
      }
      this.opaqueRefsByTab.delete(tabId);
    }
  }

  private addTombstone(token: string, code: ErrorCode, tabId: number): void {
    this.tombstones.set(token, { code, tabId });
    while (this.tombstones.size > this.maxTombstones) {
      const oldestToken = this.tombstones.keys().next().value as string | undefined;
      if (!oldestToken) break;
      this.tombstones.delete(oldestToken);
    }
  }

  private getTombstoneMessage(code: ErrorCode): string {
    if (code === ERROR_CODES.TAB_CLOSED) return "The tab that produced this ref is closed.";
    if (code === ERROR_CODES.NODE_DETACHED) return "The DOM node for this ref is detached.";
    return "This ref is stale.";
  }
}
