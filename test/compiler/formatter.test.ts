import { describe, expect,it } from "vitest";

import { formatSolidity } from "../../src/compiler/formatter";
import type { FormattingConfig } from "../../src/types";

const defaultFormatting: Required<FormattingConfig> = {
  indent: 4,
  bracketSpacing: true,
  braceStyle: "same-line",
  formatOutput: false,
};

const sampleSolidity = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Test {
    uint256 public x = 0;

    function foo() public pure returns (uint256) {
        if (x > 0) {
            return x;
        }
        return 0;
    }
}
`;

// ============================================================
// Indentation
// ============================================================

describe("formatSolidity indentation", () => {
  it("should leave 4-space indentation unchanged with default config", () => {
    const result = formatSolidity(sampleSolidity, defaultFormatting);
    expect(result).toBe(sampleSolidity);
  });

  it("should convert 4-space indentation to 2-space", () => {
    const result = formatSolidity(sampleSolidity, {
      ...defaultFormatting,
      indent: 2,
    });
    expect(result).toContain("  uint256 public x = 0;");
    expect(result).toContain("  function foo() public pure returns (uint256) {");
    expect(result).toContain("    if (x > 0) {");
    expect(result).toContain("      return x;");
    expect(result).not.toContain("    uint256");
  });

  it("should convert 4-space indentation to tabs", () => {
    const result = formatSolidity(sampleSolidity, {
      ...defaultFormatting,
      indent: "tab",
    });
    expect(result).toContain("\tuint256 public x = 0;");
    expect(result).toContain("\tfunction foo() public pure returns (uint256) {");
    expect(result).toContain("\t\tif (x > 0) {");
    expect(result).toContain("\t\t\treturn x;");
  });

  it("should handle deeply nested indentation", () => {
    const deep = `contract Test {
    function foo() public {
        if (true) {
            for (uint256 i = 0; i < 10; i++) {
                x = i;
            }
        }
    }
}
`;
    const result = formatSolidity(deep, {
      ...defaultFormatting,
      indent: 2,
    });
    expect(result).toContain("  function foo() public {");
    expect(result).toContain("    if (true) {");
    expect(result).toContain("      for (uint256 i = 0; i < 10; i++) {");
    expect(result).toContain("        x = i;");
  });
});

// ============================================================
// Brace style
// ============================================================

describe("formatSolidity brace style", () => {
  it("should leave same-line braces unchanged with default config", () => {
    const result = formatSolidity(sampleSolidity, defaultFormatting);
    expect(result).toContain("contract Test {");
  });

  it("should convert to next-line braces", () => {
    const result = formatSolidity(sampleSolidity, {
      ...defaultFormatting,
      braceStyle: "next-line",
    });
    expect(result).toContain("contract Test\n{");
    expect(result).toContain("    function foo() public pure returns (uint256)\n    {");
    expect(result).toContain("        if (x > 0)\n        {");
  });

  it("should not affect lines that don't end with opening brace", () => {
    const source = `contract Test {
    uint256 public x = 0;
    string public name = "hello";
}
`;
    const result = formatSolidity(source, {
      ...defaultFormatting,
      braceStyle: "next-line",
    });
    expect(result).toContain('    uint256 public x = 0;');
    expect(result).toContain('    string public name = "hello";');
  });
});

// ============================================================
// Bracket spacing
// ============================================================

describe("formatSolidity bracket spacing", () => {
  it("should leave bracket spacing when enabled (default)", () => {
    const source = "mapping( address => uint256 ) public balances;";
    const result = formatSolidity(source, defaultFormatting);
    expect(result).toBe(source);
  });

  it("should remove bracket spacing when disabled", () => {
    const source = "mapping( address => uint256 ) public balances;";
    const result = formatSolidity(source, {
      ...defaultFormatting,
      bracketSpacing: false,
    });
    expect(result).toBe("mapping(address => uint256) public balances;");
  });
});

// ============================================================
// Combined options
// ============================================================

describe("formatSolidity combined options", () => {
  it("should apply indentation and brace style together", () => {
    const result = formatSolidity(sampleSolidity, {
      ...defaultFormatting,
      indent: 2,
      braceStyle: "next-line",
    });
    expect(result).toContain("contract Test\n{");
    expect(result).toContain("  uint256 public x = 0;");
    expect(result).toContain("  function foo() public pure returns (uint256)\n  {");
  });

  it("should apply tabs and next-line braces together", () => {
    const result = formatSolidity(sampleSolidity, {
      ...defaultFormatting,
      indent: "tab",
      braceStyle: "next-line",
    });
    expect(result).toContain("contract Test\n{");
    expect(result).toContain("\tuint256 public x = 0;");
    expect(result).toContain("\tfunction foo() public pure returns (uint256)\n\t{");
  });
});
