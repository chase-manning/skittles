import { describe, expect,it } from "vitest";

import { getErrorMessage } from "../../src/utils/error";

describe("getErrorMessage", () => {
  it("returns the message from an Error instance", () => {
    expect(getErrorMessage(new Error("something broke"))).toBe(
      "something broke"
    );
  });

  it("returns the default fallback for non-Error values", () => {
    expect(getErrorMessage("string error")).toBe("Unknown error");
    expect(getErrorMessage(42)).toBe("Unknown error");
    expect(getErrorMessage(null)).toBe("Unknown error");
    expect(getErrorMessage(undefined)).toBe("Unknown error");
  });

  it("returns a custom fallback when provided", () => {
    expect(getErrorMessage("oops", "Custom fallback")).toBe("Custom fallback");
    expect(getErrorMessage(null, "Something went wrong")).toBe(
      "Something went wrong"
    );
  });

  it("uses Error.message even when a custom fallback is provided", () => {
    expect(getErrorMessage(new Error("real message"), "fallback")).toBe(
      "real message"
    );
  });
});
