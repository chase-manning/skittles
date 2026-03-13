import { describe, expect,it } from "vitest";

import { getPackageVersion } from "../../src/utils/package";

describe("getPackageVersion", () => {
  it("returns a valid semver version string", () => {
    const version = getPackageVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("returns the same value on subsequent calls", () => {
    const first = getPackageVersion();
    const second = getPackageVersion();
    expect(first).toBe(second);
  });
});
