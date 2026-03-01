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

  it("should generate readonly array as internal with public getter", () => {
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
      })
    );
    expect(sol).toContain("address[] internal admins;");
    expect(sol).toContain("function getAdmins() public view returns (address[] memory)");
    expect(sol).toContain("return admins;");
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

  it("should generate a constructor with default parameter as local variable", () => {
    const sol = generateSolidity(
      emptyContract({
        ctor: {
          parameters: [
            {
              name: "supply",
              type: { kind: SkittlesTypeKind.Uint256 },
              defaultValue: { kind: "number-literal", value: "1000000" },
            },
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
                  property: "totalSupply",
                },
                value: { kind: "identifier", name: "supply" },
              },
            },
          ],
        },
      })
    );
    expect(sol).toContain("constructor() {");
    expect(sol).toContain("uint256 supply = 1000000;");
    expect(sol).toContain("totalSupply = supply;");
  });

  it("should generate a constructor with mixed default and required parameters", () => {
    const sol = generateSolidity(
      emptyContract({
        ctor: {
          parameters: [
            { name: "name", type: { kind: SkittlesTypeKind.String } },
            {
              name: "supply",
              type: { kind: SkittlesTypeKind.Uint256 },
              defaultValue: { kind: "number-literal", value: "1000000" },
            },
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
                  property: "tokenName",
                },
                value: { kind: "identifier", name: "name" },
              },
            },
          ],
        },
      })
    );
    expect(sol).toContain("constructor(string memory name) {");
    expect(sol).toContain("uint256 supply = 1000000;");
    expect(sol).toContain("tokenName = name;");
  });

  it("should omit super() call with no arguments in constructor", () => {
    const sol = generateSolidity(
      emptyContract({
        inherits: ["Base"],
        ctor: {
          parameters: [
            { name: "initialSupply", type: { kind: SkittlesTypeKind.Uint256 } },
          ],
          body: [
            {
              kind: "expression",
              expression: {
                kind: "call",
                callee: { kind: "identifier", name: "super" },
                args: [],
              },
            },
            {
              kind: "expression",
              expression: {
                kind: "call",
                callee: { kind: "identifier", name: "_mint" },
                args: [
                  { kind: "identifier", name: "msg.sender" },
                  { kind: "identifier", name: "initialSupply" },
                ],
              },
            },
          ],
        },
      })
    );
    expect(sol).toContain("constructor(uint256 initialSupply) {");
    expect(sol).not.toContain("super");
    expect(sol).toContain("_mint(msg.sender, initialSupply);");
  });

  it("should generate parent constructor modifier for super() with arguments", () => {
    const sol = generateSolidity(
      emptyContract({
        inherits: ["ERC20"],
        ctor: {
          parameters: [
            { name: "initialSupply", type: { kind: SkittlesTypeKind.Uint256 } },
          ],
          body: [
            {
              kind: "expression",
              expression: {
                kind: "call",
                callee: { kind: "identifier", name: "super" },
                args: [
                  { kind: "string-literal", value: "MyToken" },
                  { kind: "string-literal", value: "MTK" },
                ],
              },
            },
            {
              kind: "expression",
              expression: {
                kind: "call",
                callee: { kind: "identifier", name: "_mint" },
                args: [
                  { kind: "identifier", name: "msg.sender" },
                  { kind: "identifier", name: "initialSupply" },
                ],
              },
            },
          ],
        },
      })
    );
    expect(sol).toContain('constructor(uint256 initialSupply) ERC20("MyToken", "MTK") {');
    expect(sol).not.toContain("super");
    expect(sol).toContain("_mint(msg.sender, initialSupply);");
  });

  it("should throw when super() is called with args but no parent in inherits", () => {
    expect(() =>
      generateSolidity(
        emptyContract({
          inherits: [],
          ctor: {
            parameters: [],
            body: [
              {
                kind: "expression",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "super" },
                  args: [{ kind: "string-literal", value: "Token" }],
                },
              },
            ],
          },
        })
      )
    ).toThrow("no parent contract is specified");
  });

  it("should throw when super() with args is used alongside default parameters", () => {
    expect(() =>
      generateSolidity(
        emptyContract({
          inherits: ["Base"],
          ctor: {
            parameters: [
              {
                name: "supply",
                type: { kind: SkittlesTypeKind.Uint256 },
                defaultValue: { kind: "number-literal", value: "1000" },
              },
            ],
            body: [
              {
                kind: "expression",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "super" },
                  args: [{ kind: "identifier", name: "supply" }],
                },
              },
            ],
          },
        })
      )
    ).toThrow("default values is not supported");
  });

  it("should throw when multiple super() calls are present", () => {
    expect(() =>
      generateSolidity(
        emptyContract({
          inherits: ["Base"],
          ctor: {
            parameters: [],
            body: [
              {
                kind: "expression",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "super" },
                  args: [],
                },
              },
              {
                kind: "expression",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "super" },
                  args: [],
                },
              },
            ],
          },
        })
      )
    ).toThrow("multiple super() calls");
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

  it("should generate abstract contract", () => {
    const sol = generateSolidity(
      emptyContract({ name: "Base", isAbstract: true })
    );
    expect(sol).toContain("abstract contract Base {");
  });

  it("should generate abstract function without body", () => {
    const sol = generateSolidity(
      emptyContract({
        name: "Base",
        isAbstract: true,
        functions: [
          {
            name: "getValue",
            parameters: [],
            returnType: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            stateMutability: "nonpayable",
            isVirtual: true,
            isOverride: false,
            isAbstract: true,
            body: [],
          },
        ],
      })
    );
    expect(sol).toContain("abstract contract Base {");
    expect(sol).toContain("function getValue() public virtual returns (uint256);");
    expect(sol).not.toContain("function getValue() public virtual returns (uint256) {");
  });

  it("should generate a function with tuple return type", () => {
    const sol = generateSolidity(
      emptyContract({
        variables: [
          {
            name: "reserve0",
            type: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            immutable: false,
            constant: false,
            initialValue: { kind: "number-literal", value: "0" },
          },
          {
            name: "reserve1",
            type: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            immutable: false,
            constant: false,
            initialValue: { kind: "number-literal", value: "0" },
          },
        ],
        functions: [
          {
            name: "getReserves",
            parameters: [],
            returnType: {
              kind: SkittlesTypeKind.Tuple,
              tupleTypes: [
                { kind: SkittlesTypeKind.Uint256 },
                { kind: SkittlesTypeKind.Uint256 },
                { kind: SkittlesTypeKind.Uint256 },
              ],
            },
            visibility: "public",
            stateMutability: "view",
            isVirtual: true,
            isOverride: false,
            body: [
              {
                kind: "return",
                value: {
                  kind: "tuple-literal",
                  elements: [
                    {
                      kind: "property-access",
                      object: { kind: "identifier", name: "this" },
                      property: "reserve0",
                    },
                    {
                      kind: "property-access",
                      object: { kind: "identifier", name: "this" },
                      property: "reserve1",
                    },
                    {
                      kind: "property-access",
                      object: { kind: "identifier", name: "block" },
                      property: "timestamp",
                    },
                  ],
                },
              },
            ],
          },
        ],
      })
    );
    expect(sol).toContain(
      "function getReserves() public view virtual returns (uint256, uint256, uint256) {"
    );
    expect(sol).toContain("return (reserve0, reserve1, block.timestamp);");
  });

  it("should add hardhat console import when contract uses console.log", () => {
    const sol = generateSolidity(
      emptyContract({
        functions: [
          {
            name: "test",
            parameters: [],
            returnType: null,
            visibility: "public",
            stateMutability: "nonpayable",
            isVirtual: false,
            isOverride: false,
            body: [
              {
                kind: "console-log",
                args: [{ kind: "string-literal", value: "hello" }],
              },
            ],
          },
        ],
      })
    );
    expect(sol).toContain('import "hardhat/console.sol";');
    expect(sol).toContain('console.log("hello");');
  });

  it("should not add hardhat console import when contract does not use console.log", () => {
    const sol = generateSolidity(emptyContract());
    expect(sol).not.toContain('import "hardhat/console.sol"');
  });

  it("should generate contract with interface type variable", () => {
    const sol = generateSolidity(
      emptyContract({
        variables: [
          {
            name: "token",
            type: { kind: SkittlesTypeKind.ContractInterface, structName: "IToken" },
            visibility: "private",
            immutable: false,
            constant: false,
          },
        ],
        contractInterfaces: [
          {
            name: "IToken",
            functions: [
              {
                name: "balanceOf",
                parameters: [{ name: "account", type: { kind: SkittlesTypeKind.Address } }],
                returnType: { kind: SkittlesTypeKind.Uint256 },
                stateMutability: "view",
              },
            ],
          },
        ],
      })
    );
    expect(sol).toContain("interface IToken {");
    expect(sol).toContain("IToken internal token;");
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

  it("should generate tuple type", () => {
    const t: SkittlesType = {
      kind: SkittlesTypeKind.Tuple,
      tupleTypes: [
        { kind: SkittlesTypeKind.Uint256 },
        { kind: SkittlesTypeKind.Bool },
        { kind: SkittlesTypeKind.Address },
      ],
    };
    expect(generateType(t)).toBe("(uint256, bool, address)");
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

  it("should generate tuple literal expression", () => {
    const expr: Expression = {
      kind: "tuple-literal",
      elements: [
        { kind: "number-literal", value: "1" },
        { kind: "boolean-literal", value: true },
        { kind: "identifier", name: "x" },
      ],
    };
    expect(generateExpression(expr)).toBe("(1, true, x)");
  });

  it("should generate Contract<IToken>(addr) as IToken(addr)", () => {
    const expr: Expression = {
      kind: "call",
      callee: { kind: "identifier", name: "Contract" },
      args: [{ kind: "identifier", name: "tokenAddress" }],
      typeArgs: [{ kind: SkittlesTypeKind.ContractInterface, structName: "IToken" }],
    };
    expect(generateExpression(expr)).toBe("IToken(tokenAddress)");
  });

  it("should generate addr.transfer(amount) as payable(addr).transfer(amount)", () => {
    const expr: Expression = {
      kind: "call",
      callee: {
        kind: "property-access",
        object: { kind: "identifier", name: "recipient" },
        property: "transfer",
      },
      args: [{ kind: "identifier", name: "amount" }],
    };
    expect(generateExpression(expr)).toBe("payable(recipient).transfer(amount)");
  });

  it("should generate msg.sender.transfer(amount) as payable(msg.sender).transfer(amount)", () => {
    const expr: Expression = {
      kind: "call",
      callee: {
        kind: "property-access",
        object: {
          kind: "property-access",
          object: { kind: "identifier", name: "msg" },
          property: "sender",
        },
        property: "transfer",
      },
      args: [{ kind: "identifier", name: "amount" }],
    };
    expect(generateExpression(expr)).toBe("payable(msg.sender).transfer(amount)");
  });

  it("should not wrap this.transfer in payable", () => {
    const expr: Expression = {
      kind: "call",
      callee: {
        kind: "property-access",
        object: { kind: "identifier", name: "this" },
        property: "transfer",
      },
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

  it("should generate try/catch with return value", () => {
    const stmt: Statement = {
      kind: "try-catch",
      call: {
        kind: "call",
        callee: {
          kind: "property-access",
          object: { kind: "identifier", name: "token" },
          property: "balanceOf",
        },
        args: [{ kind: "identifier", name: "account" }],
      },
      returnVarName: "balance",
      returnType: { kind: SkittlesTypeKind.Uint256 },
      successBody: [
        {
          kind: "return",
          value: { kind: "identifier", name: "balance" },
        },
      ],
      catchBody: [
        {
          kind: "return",
          value: { kind: "number-literal", value: "0" },
        },
      ],
    };
    const result = generateStatement(stmt, "");
    expect(result).toContain("try token.balanceOf(account) returns (uint256 balance) {");
    expect(result).toContain("return balance;");
    expect(result).toContain("} catch {");
    expect(result).toContain("return 0;");
  });

  it("should generate try/catch without return value", () => {
    const stmt: Statement = {
      kind: "try-catch",
      call: {
        kind: "call",
        callee: {
          kind: "property-access",
          object: { kind: "identifier", name: "token" },
          property: "transfer",
        },
        args: [
          { kind: "identifier", name: "to" },
          { kind: "identifier", name: "amount" },
        ],
      },
      successBody: [],
      catchBody: [
        {
          kind: "return",
        },
      ],
    };
    const result = generateStatement(stmt, "");
    expect(result).toContain("try token.transfer(to, amount) {");
    expect(result).toContain("} catch {");
    expect(result).toContain("return;");
  });

  it("should generate console.log statement", () => {
    const stmt: Statement = {
      kind: "console-log",
      args: [{ kind: "string-literal", value: "hello" }],
    };
    expect(generateStatement(stmt, "")).toBe('console.log("hello");');
  });

  it("should generate console.log with multiple arguments", () => {
    const stmt: Statement = {
      kind: "console-log",
      args: [
        { kind: "string-literal", value: "value:" },
        { kind: "identifier", name: "x" },
      ],
    };
    expect(generateStatement(stmt, "")).toBe('console.log("value:", x);');
  });

  it("should generate console.log with indent", () => {
    const stmt: Statement = {
      kind: "console-log",
      args: [{ kind: "number-literal", value: "42" }],
    };
    expect(generateStatement(stmt, "        ")).toBe("        console.log(42);");
  });
});
