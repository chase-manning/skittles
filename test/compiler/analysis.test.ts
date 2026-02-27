import { describe, it, expect } from "vitest";
import { analyzeFunction } from "../../src/compiler/analysis";
import { SkittlesTypeKind } from "../../src/types/index";
import type { SkittlesFunction, Statement } from "../../src/types/index";

function makeFunction(name: string, body: Statement[], params: string[] = []): SkittlesFunction {
  return {
    name,
    parameters: params.map((p) => ({ name: p, type: { kind: SkittlesTypeKind.Uint256 } })),
    returnType: null,
    visibility: "public",
    stateMutability: "nonpayable",
    isVirtual: false,
    isOverride: false,
    body,
  };
}

// ============================================================
// Unreachable code detection
// ============================================================

describe("unreachable code detection", () => {
  it("should not warn for a function with no issues", () => {
    const fn = makeFunction("test", [
      { kind: "variable-declaration", name: "x", type: { kind: SkittlesTypeKind.Uint256 }, initializer: { kind: "number-literal", value: "1" } },
      { kind: "return", value: { kind: "identifier", name: "x" } },
    ]);
    const warnings = analyzeFunction(fn, "MyContract");
    expect(warnings).toHaveLength(0);
  });

  it("should warn about code after return", () => {
    const fn = makeFunction("test", [
      { kind: "return", value: { kind: "number-literal", value: "1" } },
      { kind: "expression", expression: { kind: "identifier", name: "x" } },
    ]);
    const warnings = analyzeFunction(fn, "MyContract");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Unreachable code after 'return'");
    expect(warnings[0]).toContain("MyContract.test");
  });

  it("should warn about code after throw (revert)", () => {
    const fn = makeFunction("test", [
      { kind: "revert", message: { kind: "string-literal", value: "error" } },
      { kind: "expression", expression: { kind: "identifier", name: "x" } },
    ]);
    const warnings = analyzeFunction(fn, "MyContract");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Unreachable code after 'throw'");
  });

  it("should warn about code after break", () => {
    const fn = makeFunction("test", [
      {
        kind: "for",
        initializer: { kind: "variable-declaration", name: "i", type: { kind: SkittlesTypeKind.Uint256 }, initializer: { kind: "number-literal", value: "0" } },
        condition: { kind: "binary", operator: "<", left: { kind: "identifier", name: "i" }, right: { kind: "number-literal", value: "10" } },
        incrementor: { kind: "unary", operator: "++", operand: { kind: "identifier", name: "i" }, prefix: false },
        body: [
          { kind: "break" },
          { kind: "expression", expression: { kind: "identifier", name: "x" } },
        ],
      },
    ]);
    const warnings = analyzeFunction(fn, "MyContract");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Unreachable code after 'break'");
  });

  it("should warn about code after continue", () => {
    const fn = makeFunction("test", [
      {
        kind: "while",
        condition: { kind: "boolean-literal", value: true },
        body: [
          { kind: "continue" },
          { kind: "expression", expression: { kind: "identifier", name: "x" } },
        ],
      },
    ]);
    const warnings = analyzeFunction(fn, "MyContract");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Unreachable code after 'continue'");
  });

  it("should detect unreachable code in nested if blocks", () => {
    const fn = makeFunction("test", [
      {
        kind: "if",
        condition: { kind: "boolean-literal", value: true },
        thenBody: [
          { kind: "return", value: { kind: "number-literal", value: "1" } },
          { kind: "expression", expression: { kind: "identifier", name: "x" } },
        ],
      },
    ]);
    const warnings = analyzeFunction(fn, "MyContract");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Unreachable code after 'return'");
  });

  it("should not warn when return is the last statement", () => {
    const fn = makeFunction("test", [
      { kind: "expression", expression: { kind: "identifier", name: "x" } },
      { kind: "return", value: { kind: "number-literal", value: "1" } },
    ]);
    const warnings = analyzeFunction(fn, "MyContract");
    expect(warnings).toHaveLength(0);
  });
});

// ============================================================
// Unused variable detection
// ============================================================

describe("unused variable detection", () => {
  it("should not warn when all variables are used", () => {
    const fn = makeFunction("test", [
      { kind: "variable-declaration", name: "x", type: { kind: SkittlesTypeKind.Uint256 }, initializer: { kind: "number-literal", value: "1" } },
      { kind: "return", value: { kind: "identifier", name: "x" } },
    ]);
    const warnings = analyzeFunction(fn, "MyContract");
    expect(warnings).toHaveLength(0);
  });

  it("should warn about unused local variables", () => {
    const fn = makeFunction("test", [
      { kind: "variable-declaration", name: "x", type: { kind: SkittlesTypeKind.Uint256 }, initializer: { kind: "number-literal", value: "1" } },
      { kind: "return", value: { kind: "number-literal", value: "0" } },
    ]);
    const warnings = analyzeFunction(fn, "MyContract");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Unused variable 'x'");
    expect(warnings[0]).toContain("MyContract.test");
  });

  it("should not warn about unused parameters", () => {
    const fn = makeFunction("test", [
      { kind: "return", value: { kind: "number-literal", value: "0" } },
    ], ["unusedParam"]);
    const warnings = analyzeFunction(fn, "MyContract");
    expect(warnings).toHaveLength(0);
  });

  it("should detect usage in nested expressions", () => {
    const fn = makeFunction("test", [
      { kind: "variable-declaration", name: "x", type: { kind: SkittlesTypeKind.Uint256 }, initializer: { kind: "number-literal", value: "1" } },
      {
        kind: "if",
        condition: { kind: "binary", operator: ">", left: { kind: "identifier", name: "x" }, right: { kind: "number-literal", value: "0" } },
        thenBody: [
          { kind: "return", value: { kind: "number-literal", value: "1" } },
        ],
      },
    ]);
    const warnings = analyzeFunction(fn, "MyContract");
    expect(warnings).toHaveLength(0);
  });

  it("should detect usage in for loop body", () => {
    const fn = makeFunction("test", [
      { kind: "variable-declaration", name: "total", type: { kind: SkittlesTypeKind.Uint256 }, initializer: { kind: "number-literal", value: "0" } },
      {
        kind: "for",
        initializer: { kind: "variable-declaration", name: "i", type: { kind: SkittlesTypeKind.Uint256 }, initializer: { kind: "number-literal", value: "0" } },
        condition: { kind: "binary", operator: "<", left: { kind: "identifier", name: "i" }, right: { kind: "number-literal", value: "10" } },
        incrementor: { kind: "unary", operator: "++", operand: { kind: "identifier", name: "i" }, prefix: false },
        body: [
          {
            kind: "expression",
            expression: {
              kind: "assignment",
              operator: "+=",
              target: { kind: "identifier", name: "total" },
              value: { kind: "identifier", name: "i" },
            },
          },
        ],
      },
      { kind: "return", value: { kind: "identifier", name: "total" } },
    ]);
    const warnings = analyzeFunction(fn, "MyContract");
    expect(warnings).toHaveLength(0);
  });

  it("should warn about multiple unused variables", () => {
    const fn = makeFunction("test", [
      { kind: "variable-declaration", name: "a", type: { kind: SkittlesTypeKind.Uint256 }, initializer: { kind: "number-literal", value: "1" } },
      { kind: "variable-declaration", name: "b", type: { kind: SkittlesTypeKind.Uint256 }, initializer: { kind: "number-literal", value: "2" } },
      { kind: "return", value: { kind: "number-literal", value: "0" } },
    ]);
    const warnings = analyzeFunction(fn, "MyContract");
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("Unused variable 'a'");
    expect(warnings[1]).toContain("Unused variable 'b'");
  });

  it("should not flag a variable used only in an assignment target", () => {
    // If x is assigned to, it still counts as "used" (the identifier appears)
    const fn = makeFunction("test", [
      { kind: "variable-declaration", name: "x", type: { kind: SkittlesTypeKind.Uint256 }, initializer: { kind: "number-literal", value: "0" } },
      {
        kind: "expression",
        expression: {
          kind: "assignment",
          operator: "=",
          target: { kind: "identifier", name: "x" },
          value: { kind: "number-literal", value: "5" },
        },
      },
    ]);
    const warnings = analyzeFunction(fn, "MyContract");
    // x is referenced in assignment target, so identifier is "used"
    expect(warnings).toHaveLength(0);
  });
});

// ============================================================
// Combined detection
// ============================================================

describe("combined unreachable code and unused variables", () => {
  it("should detect both unreachable code and unused variables", () => {
    const fn = makeFunction("test", [
      { kind: "variable-declaration", name: "unused", type: { kind: SkittlesTypeKind.Uint256 }, initializer: { kind: "number-literal", value: "1" } },
      { kind: "return", value: { kind: "number-literal", value: "0" } },
      { kind: "expression", expression: { kind: "identifier", name: "x" } },
    ]);
    const warnings = analyzeFunction(fn, "MyContract");
    expect(warnings).toHaveLength(2);
    expect(warnings.some((w) => w.includes("Unreachable code"))).toBe(true);
    expect(warnings.some((w) => w.includes("Unused variable"))).toBe(true);
  });
});
