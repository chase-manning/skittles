import { describe, it, expect, beforeEach } from "vitest";
import {
  getStdlibClassNames,
  clearStdlibRegistryCache,
} from "../../src/stdlib/resolver";

describe("stdlib resolver cache", () => {
  beforeEach(() => {
    clearStdlibRegistryCache();
  });

  it("returns a non-empty set of class names", () => {
    const names = getStdlibClassNames();
    expect(names.size).toBeGreaterThan(0);
    expect(names.has("ERC20")).toBe(true);
  });

  it("returns the same results after clearing and rebuilding the cache", () => {
    const first = getStdlibClassNames();
    clearStdlibRegistryCache();
    const second = getStdlibClassNames();
    expect(second).toEqual(first);
  });

  it("clearStdlibRegistryCache forces a fresh scan on next access", () => {
    // Access once to populate cache
    const before = getStdlibClassNames();
    expect(before.size).toBeGreaterThan(0);

    // Clear and re-fetch — should still work correctly
    clearStdlibRegistryCache();
    const after = getStdlibClassNames();
    expect(after.size).toBeGreaterThan(0);
    expect(after).toEqual(before);
  });
});
