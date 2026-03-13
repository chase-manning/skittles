import { describe, expect,it } from "vitest";

import { getErrorMessage } from "../../src/utils/error";

describe("getErrorMessage", () => {
  it("returns the message from an Error instance", () => {
    expect(getErrorMessage(new Error("something broke"))).toBe(
      "something broke"
    );
  });

  it("returns the default fallback for null and undefined", () => {
    expect(getErrorMessage(null)).toBe("Unknown error occurred");
    expect(getErrorMessage(undefined)).toBe("Unknown error occurred");
  });

  it("stringifies non-Error, non-nullish values", () => {
    expect(getErrorMessage("string error")).toBe("string error");
    expect(getErrorMessage(42)).toBe("42");
  });

  it("returns a custom fallback for nullish values when provided", () => {
    expect(getErrorMessage(null, "Something went wrong")).toBe(
      "Something went wrong"
    );
    expect(getErrorMessage(undefined, "Custom fallback")).toBe(
      "Custom fallback"
    );
  });

  it("stringifies non-Error values even when a custom fallback is provided", () => {
    expect(getErrorMessage("oops", "Custom fallback")).toBe("oops");
  });

  it("uses Error.message even when a custom fallback is provided", () => {
    expect(getErrorMessage(new Error("real message"), "fallback")).toBe(
      "real message"
    );
  });
});
