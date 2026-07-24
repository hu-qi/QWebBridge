import { describe, it, expect, beforeEach } from "vitest";
import { RefStore } from "../ref-store.js";

describe("RefStore", () => {
  let store: RefStore;

  beforeEach(() => {
    store = new RefStore();
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
