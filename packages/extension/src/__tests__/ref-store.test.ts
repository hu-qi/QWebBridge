import { describe, it, expect, beforeEach } from "vitest";
import { RefStore } from "../ref-store.js";

describe("RefStore", () => {
  let store: RefStore;

  beforeEach(() => {
    store = new RefStore();
  });

  it("routes an opaque ref to its source tab", () => {
    const ref = store.issue(12, 345);

    expect(ref).toMatch(/^@qref_v1_[a-zA-Z0-9-]+_[a-zA-Z0-9-]+$/);
    expect(store.resolve(ref)).toEqual({
      tabId: 12,
      backendDOMNodeId: 345,
    });
  });

  it("rejects a tab that conflicts with an opaque ref", () => {
    const ref = store.issue(12, 345);

    expect(() => store.resolve(ref, 13)).toThrowError(
      expect.objectContaining({
        code: "ref_tab_mismatch",
      }),
    );
  });

  it("rejects refs from an earlier service worker instance", () => {
    const previous = new RefStore({ runtimePrefix: "worker-a", createId: () => "ref-a" });
    const restarted = new RefStore({ runtimePrefix: "worker-b", createId: () => "ref-b" });
    const ref = previous.issue(12, 345);

    expect(() => restarted.resolve(ref)).toThrowError(
      expect.objectContaining({
        code: "stale_ref",
      }),
    );
  });

  it("reports an unknown ref from the current worker instance", () => {
    const current = new RefStore({ runtimePrefix: "worker-a", createId: () => "ref-a" });

    expect(() => current.resolve("@qref_v1_worker-a_missing")).toThrowError(
      expect.objectContaining({
        code: "unknown_ref",
      }),
    );
  });

  it("rejects a malformed opaque ref", () => {
    expect(() => store.resolve("@qref_invalid")).toThrowError(
      expect.objectContaining({
        code: "invalid_ref",
      }),
    );
  });

  it("invalidates refs when a new snapshot replaces the tab refs", () => {
    store.beginSnapshot(12);
    const oldRef = store.issue(12, 345);

    store.beginSnapshot(12);
    const currentRef = store.issue(12, 678);

    expect(() => store.resolve(oldRef)).toThrowError(
      expect.objectContaining({
        code: "stale_ref",
      }),
    );
    expect(store.resolve(currentRef)?.backendDOMNodeId).toBe(678);
  });

  it("keeps current refs when wait_for adds another ref", () => {
    store.beginSnapshot(12);
    const snapshotRef = store.issue(12, 345);
    const waitRef = store.issue(12, 678);

    expect(store.resolve(snapshotRef)?.backendDOMNodeId).toBe(345);
    expect(store.resolve(waitRef)?.backendDOMNodeId).toBe(678);
  });

  it("reports refs from a closed tab", () => {
    const ref = store.issue(12, 345);

    store.close(12);

    expect(() => store.resolve(ref)).toThrowError(
      expect.objectContaining({
        code: "tab_closed",
      }),
    );
  });

  it("reports a closed tab after debugger detach clears its refs", () => {
    const ref = store.issue(12, 345);

    store.clear(12);
    store.close(12);

    expect(() => store.resolve(ref)).toThrowError(
      expect.objectContaining({
        code: "tab_closed",
      }),
    );
  });

  it("should store and retrieve refs", () => {
    store.set(1, "e0", 123);
    expect(store.get(1, "e0")?.backendDOMNodeId).toBe(123);
  });

  it("should isolate refs by tab", () => {
    store.set(1, "e0", 123);
    store.set(2, "e0", 456);
    expect(store.get(1, "e0")?.backendDOMNodeId).toBe(123);
    expect(store.get(2, "e0")?.backendDOMNodeId).toBe(456);
  });

  it("should detect ref strings", () => {
    expect(store.isRef("@e0")).toBe(true);
    expect(store.isRef("e0")).toBe(true);
    expect(store.isRef("#main")).toBe(false);
    expect(store.isRef("div.class")).toBe(false);
  });

  it("should resolve ref names", () => {
    expect(store.resolveRef("@e0")).toBe("e0");
    expect(store.resolveRef("e0")).toBe("e0");
  });

  it("should return undefined for unknown refs", () => {
    expect(store.get(1, "e999")).toBeUndefined();
  });

  it("should clear refs for one tab", () => {
    store.set(1, "e0", 1);
    store.set(2, "e0", 2);
    store.clear(1);
    expect(store.get(1, "e0")).toBeUndefined();
    expect(store.get(2, "e0")?.backendDOMNodeId).toBe(2);
    expect(store.size).toBe(1);
  });
});
