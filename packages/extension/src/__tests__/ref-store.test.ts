import { describe, it, expect, beforeEach } from "vitest";
import { RefStore } from "../ref-store.js";

describe("RefStore", () => {
  let store: RefStore;

  beforeEach(() => {
    store = new RefStore();
  });

  it("should store and retrieve refs", () => {
    store.set("e0", 123);
    expect(store.get("e0")?.backendDOMNodeId).toBe(123);
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
    expect(store.get("e999")).toBeUndefined();
  });

  it("should clear all refs", () => {
    store.set("e0", 1);
    store.set("e1", 2);
    store.clear();
    expect(store.size).toBe(0);
  });
});
