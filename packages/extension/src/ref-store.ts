interface RefEntry {
  backendDOMNodeId: number;
}

export class RefStore {
  private refsByTab = new Map<number, Map<string, RefEntry>>();

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
    return /^@?e\d+$/.test(value);
  }

  clear(tabId: number): void {
    this.refsByTab.delete(tabId);
  }

  get size(): number {
    let size = 0;
    for (const refs of this.refsByTab.values()) {
      size += refs.size;
    }
    return size;
  }
}
