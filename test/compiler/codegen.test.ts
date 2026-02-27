import { describe, it, expect } from "vitest";
import {
  generateSolidity,
  generateType,
  generateExpression,
  generateStatement,
} from "../../src/compiler/codegen";
import { SkittlesTypeKind } from "../../src/types";
import type {
  SkittlesContract,
  SkittlesType,
  Expression,
  Statement,
} from "../../src/types";

function emptyContract(overrides: Partial<SkittlesContract> = {}): SkittlesContract {
  return {
    name: "Test",
    sourcePath: "test.ts",
    variables: [],
    functions: [],
    events: [],
    ctor: undefined,
    inherits: [],
    ...overrides,
  };
}

// ============================================================
// generateSolidity (full contract)
// ============================================================

describe("generateSolidity", () => {
  it("should generate an empty contract", () => {
    const sol = generateSolidity(emptyContract());
    expect(sol).toContain("pragma solidity ^0.8.20;");
    expect(sol).toContain("contract Test {");
    expect(sol).toContain("}");
  });

  it("should generate state variables", () => {
    const sol = generateSolidity(
      emptyContract({
        variables: [
          {
            name: "x",
            type: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            immutable: false,
            initialValue: { kind: "number-literal", value: "0" },
          },
          {
            name: "name",
            type: { kind: SkittlesTypeKind.String },
            visibility: "public",
            immutable: false,
            initialValue: { kind: "string-literal", value: "Token" },
          },
        ],
      })
    );
    expect(sol).toContain('uint256 public x = 0;');
    expect(sol).toContain('string public name = "Token";');
  });

  it("should generate mapping variables without initializer", () => {
    const sol = generateSolidity(
      emptyContract({
        variables: [
          {
            name: "balances",
            type: {
              kind: SkittlesTypeKind.Mapping,
              keyType: { kind: SkittlesTypeKind.Address },
              valueType: { kind: SkittlesTypeKind.Uint256 },
            },
            visibility: "private",
            immutable: false,
          },
        ],
      })
    );
    expect(sol).toContain(
      "mapping(address => uint256) internal balances;"
    );
  });

  it("should generate a constructor", () => {
    const sol = generateSolidity(
      emptyContract({
        ctor: {
          parameters: [
            { name: "val", type: { kind: SkittlesTypeKind.Uint256 } },
          ],
          body: [
            {
              kind: "expression",
              expression: {
                kind: "assignment",
                operator: "=",
                target: {
                  kind: "property-access",
                  object: { kind: "identifier", name: "this" },
                  property: "x",
                },
                value: { kind: "identifier", name: "val" },
              },
            },
          ],
        },
      })
    );
    expect(sol).toContain("constructor(uint256 val) {");
    expect(sol).toContain("x = val;");
  });

  it("should generate a view function", () => {
    const sol = generateSolidity(
      emptyContract({
        functions: [
          {
            name: "getX",
            parameters: [],
            returnType: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            stateMutability: "view",
            body: [
              {
                kind: "return",
                value: {
                  kind: "property-access",
                  object: { kind: "identifier", name: "this" },
                  property: "x",
                },
              },
            ],
          },
        ],
      })
    );
    expect(sol).toContain(
      "function getX() public view returns (uint256) {"
    );
    expect(sol).toContain("return x;");
  });

  it("should generate string memory for string parameters", () => {
    const sol = generateSolidity(
      emptyContract({
        functions: [
          {
            name: "setName",
            parameters: [
              {
                name: "newName",
                type: { kind: SkittlesTypeKind.String },
              },
            ],
            returnType: null,
            visibility: "public",
            stateMutability: "nonpayable",
            body: [],
          },
        ],
      })
    );
    expect(sol).toContain("function setName(string memory newName)");
  });

  it("should generate event declarations", () => {
    const sol = generateSolidity(
      emptyContract({
        events: [
          {
            name: "Transfer",
            parameters: [
              { name: "from", type: { kind: SkittlesTypeKind.Address } },
              { name: "to", type: { kind: SkittlesTypeKind.Address } },
              { name: "amount", type: { kind: SkittlesTypeKind.Uint256 } },
            ],
          },
        ],
      })
    );
    expect(sol).toContain(
      "event Transfer(address from, address to, uint256 amount);"
    );
  });

  it("should generate inheritance", () => {
    const sol = generateSolidity(
      emptyContract({ name: "Token", inherits: ["ERC20"] })
    );
    expect(sol).toContain("contract Token is ERC20 {");
  });

  it("should generate lock pattern for readonly arrays", () => {
    const sol = generateSolidity(
      emptyContract({
        variables: [
          {
            name: "admins",
            type: {
              kind: SkittlesTypeKind.Array,
              valueType: { kind: SkittlesTypeKind.Address },
            },
            visibility: "public",
            immutable: true,
            constant: false,
          },
        ],
        ctor: {
          parameters: [],
          body: [
            {
              kind: "expression",
              expression: {
                kind: "call",
                callee: {
                  kind: "property-access",
                  object: {
                    kind: "property-access",
                    object: { kind: "identifier", name: "this" },
                    property: "admins",
                  },
                  property: "push",
                },
                args: [
                  {
                    kind: "property-access",
                    object: { kind: "identifier", name: "msg" },
                    property: "sender",
                  },
                ],
              },
            },
          ],
        },
      })
    );
    expect(sol).toContain("bool private _adminsLocked;");
    expect(sol).toContain("admins.push(msg.sender);");
    expect(sol).toContain("_adminsLocked = true;");
  });

  it("should generate constructor with lock even without user-defined constructor", () => {
    const sol = generateSolidity(
      emptyContract({
        variables: [
          {
            name: "values",
            type: {
              kind: SkittlesTypeKind.Array,
              valueType: { kind: SkittlesTypeKind.Uint256 },
            },
            visibility: "public",
            immutable: true,
            constant: false,
          },
        ],
      })
    );
    expect(sol).toContain("bool private _valuesLocked;");
    expect(sol).toContain("constructor()");
    expect(sol).toContain("_valuesLocked = true;");
  });

  it("should generate require check for push on readonly array in functions", () => {
    const sol = generateSolidity(
      emptyContract({
        variables: [
          {
            name: "admins",
            type: {
              kind: SkittlesTypeKind.Array,
              valueType: { kind: SkittlesTypeKind.Address },
            },
            visibility: "public",
            immutable: true,
            constant: false,
          },
        ],
        functions: [
          {
            name: "addAdmin",
            parameters: [
              { name: "admin", type: { kind: SkittlesTypeKind.Address } },
            ],
            returnType: null,
            visibility: "public",
            stateMutability: "nonpayable",
            isVirtual: true,
            isOverride: false,
            body: [
              {
                kind: "expression",
                expression: {
                  kind: "call",
                  callee: {
                    kind: "property-access",
                    object: {
                      kind: "property-access",
                      object: { kind: "identifier", name: "this" },
                      property: "admins",
                    },
                    property: "push",
                  },
                  args: [{ kind: "identifier", name: "admin" }],
                },
              },
            ],
          },
        ],
      })
    );
    expect(sol).toContain('require(!_adminsLocked, "Array is immutable");');
    expect(sol).toContain("admins.push(admin);");
  });
});

// ============================================================
// generateType
// ============================================================

describe("generateType", () => {
  it("should generate primitive types", () => {
    expect(generateType({ kind: SkittlesTypeKind.Uint256 })).toBe("uint256");
    expect(generateType({ kind: SkittlesTypeKind.Address })).toBe("address");
    expect(generateType({ kind: SkittlesTypeKind.Bool })).toBe("bool");
    expect(generateType({ kind: SkittlesTypeKind.String })).toBe("string");
  });

  it("should generate mapping type", () => {
    const t: SkittlesType = {
      kind: SkittlesTypeKind.Mapping,
      keyType: { kind: SkittlesTypeKind.Address },
      valueType: { kind: SkittlesTypeKind.Uint256 },
    };
    expect(generateType(t)).toBe("mapping(address => uint256)");
  });

  it("should generate nested mapping", () => {
    const t: SkittlesType = {
      kind: SkittlesTypeKind.Mapping,
      keyType: { kind: SkittlesTypeKind.Address },
      valueType: {
        kind: SkittlesTypeKind.Mapping,
        keyType: { kind: SkittlesTypeKind.Address },
        valueType: { kind: SkittlesTypeKind.Uint256 },
      },
    };
    expect(generateType(t)).toBe(
      "mapping(address => mapping(address => uint256))"
    );
  });

  it("should generate array type", () => {
    const t: SkittlesType = {
      kind: SkittlesTypeKind.Array,
      valueType: { kind: SkittlesTypeKind.Uint256 },
    };
    expect(generateType(t)).toBe("uint256[]");
  });
});

// ============================================================
// generateExpression
// ============================================================

describe("generateExpression", () => {
  it("should generate literals", () => {
    expect(generateExpression({ kind: "number-literal", value: "42" })).toBe("42");
    expect(generateExpression({ kind: "string-literal", value: "hi" })).toBe('"hi"');
    expect(generateExpression({ kind: "boolean-literal", value: true })).toBe("true");
  });

  it("should strip this. from property access", () => {
    const expr: Expression = {
      kind: "property-access",
      object: { kind: "identifier", name: "this" },
      property: "x",
    };
    expect(generateExpression(expr)).toBe("x");
  });

  it("should preserve non-this property access", () => {
    const expr: Expression = {
      kind: "property-access",
      object: { kind: "identifier", name: "msg" },
      property: "sender",
    };
    expect(generateExpression(expr)).toBe("msg.sender");
  });

  it("should generate element access with this stripped", () => {
    const expr: Expression = {
      kind: "element-access",
      object: {
        kind: "property-access",
        object: { kind: "identifier", name: "this" },
        property: "balances",
      },
      index: {
        kind: "property-access",
        object: { kind: "identifier", name: "msg" },
        property: "sender",
      },
    };
    expect(generateExpression(expr)).toBe("balances[msg.sender]");
  });

  it("should generate binary expressions with parens", () => {
    const expr: Expression = {
      kind: "binary",
      operator: "+",
      left: { kind: "identifier", name: "a" },
      right: { kind: "identifier", name: "b" },
    };
    expect(generateExpression(expr)).toBe("(a + b)");
  });

  it("should generate assignment expressions", () => {
    const expr: Expression = {
      kind: "assignment",
      operator: "+=",
      target: { kind: "identifier", name: "x" },
      value: { kind: "number-literal", value: "5" },
    };
    expect(generateExpression(expr)).toBe("x += 5");
  });

  it("should generate function calls", () => {
    const expr: Expression = {
      kind: "call",
      callee: { kind: "identifier", name: "transfer" },
      args: [
        { kind: "identifier", name: "to" },
        { kind: "identifier", name: "amount" },
      ],
    };
    expect(generateExpression(expr)).toBe("transfer(to, amount)");
  });
});

// ============================================================
// generateStatement
// ============================================================

describe("generateStatement", () => {
  it("should generate return statement", () => {
    const stmt: Statement = {
      kind: "return",
      value: { kind: "identifier", name: "x" },
    };
    expect(generateStatement(stmt, "")).toBe("return x;");
  });

  it("should generate variable declaration", () => {
    const stmt: Statement = {
      kind: "variable-declaration",
      name: "x",
      type: { kind: SkittlesTypeKind.Uint256 },
      initializer: { kind: "number-literal", value: "5" },
    };
    expect(generateStatement(stmt, "")).toBe("uint256 x = 5;");
  });

  it("should generate require from if + revert pattern", () => {
    const stmt: Statement = {
      kind: "if",
      condition: {
        kind: "binary",
        operator: "<",
        left: { kind: "identifier", name: "balance" },
        right: { kind: "identifier", name: "amount" },
      },
      thenBody: [
        {
          kind: "revert",
          message: { kind: "string-literal", value: "Insufficient" },
        },
      ],
    };
    expect(generateStatement(stmt, "")).toBe(
      'require((balance >= amount), "Insufficient");'
    );
  });

  it("should generate regular if/else when not a require pattern", () => {
    const stmt: Statement = {
      kind: "if",
      condition: { kind: "identifier", name: "cond" },
      thenBody: [
        {
          kind: "return",
          value: { kind: "number-literal", value: "1" },
        },
      ],
      elseBody: [
        {
          kind: "return",
          value: { kind: "number-literal", value: "0" },
        },
      ],
    };
    const result = generateStatement(stmt, "");
    expect(result).toContain("if (cond) {");
    expect(result).toContain("return 1;");
    expect(result).toContain("} else {");
    expect(result).toContain("return 0;");
  });

  it("should generate for loop", () => {
    const stmt: Statement = {
      kind: "for",
      initializer: {
        kind: "variable-declaration",
        name: "i",
        type: { kind: SkittlesTypeKind.Uint256 },
        initializer: { kind: "number-literal", value: "0" },
      },
      condition: {
        kind: "binary",
        operator: "<",
        left: { kind: "identifier", name: "i" },
        right: { kind: "number-literal", value: "10" },
      },
      incrementor: {
        kind: "unary",
        operator: "++",
        operand: { kind: "identifier", name: "i" },
        prefix: false,
      },
      body: [],
    };
    const result = generateStatement(stmt, "");
    expect(result).toContain("for (uint256 i = 0; (i < 10); i++)");
  });

  it("should generate revert statement", () => {
    const stmt: Statement = {
      kind: "revert",
      message: { kind: "string-literal", value: "Error" },
    };
    expect(generateStatement(stmt, "")).toBe('revert("Error");');
  });
});
