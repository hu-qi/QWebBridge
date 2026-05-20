interface RefEntry {
  backendDOMNodeId: number;
}

export class RefStore {
  private refs = new Map<string, RefEntry>();

  set(ref: string, backendDOMNodeId: number): void {
    this.refs.set(ref, { backendDOMNodeId });
  }

  get(ref: string): RefEntry | undefined {
    return this.refs.get(ref);
  }

  resolveRef(ref: string): string {
    return ref.startsWith("@") ? ref.slice(1) : ref;
  }

  isRef(value: string): boolean {
    return /^@?e\d+$/.test(value);
  }

  clear(): void {
    this.refs.clear();
  }

  get size(): number {
    return this.refs.size;
  }
}
