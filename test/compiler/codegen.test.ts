import { describe, it, expect } from "vitest";
import {
  generateSolidity,
  generateSolidityFile,
  generateType,
  generateExpression,
  generateStatement,
  resolveShadowedLocals,
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
    expect(sol).toContain("// SPDX-License-Identifier: MIT");
    expect(sol).toContain("contract Test {");
    expect(sol).toContain("}");
  });

  it("should use custom solidity version and license", () => {
    const sol = generateSolidity(emptyContract(), undefined, {
      version: "^0.8.24",
      license: "GPL-3.0",
    });
    expect(sol).toContain("pragma solidity ^0.8.24;");
    expect(sol).toContain("// SPDX-License-Identifier: GPL-3.0");
    expect(sol).not.toContain("pragma solidity ^0.8.20;");
    expect(sol).not.toContain("SPDX-License-Identifier: MIT");
  });

  it("should use defaults when solidity config is not provided", () => {
    const sol = generateSolidity(emptyContract());
    expect(sol).toContain("pragma solidity ^0.8.20;");
    expect(sol).toContain("// SPDX-License-Identifier: MIT");
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

  it("should generate bytes32 state variable", () => {
    const sol = generateSolidity(
      emptyContract({
        variables: [
          {
            name: "commitment",
            type: { kind: SkittlesTypeKind.Bytes32 },
            visibility: "public",
            immutable: false,
          },
        ],
      })
    );
    expect(sol).toContain("bytes32 public commitment;");
  });

  it("should generate function with bytes32 parameter and return type", () => {
    const sol = generateSolidity(
      emptyContract({
        functions: [
          {
            name: "getHash",
            parameters: [
              { name: "data", type: { kind: SkittlesTypeKind.Bytes32 } },
            ],
            returnType: { kind: SkittlesTypeKind.Bytes32 },
            visibility: "public",
            stateMutability: "pure",
            isVirtual: true,
            body: [
              {
                kind: "return",
                value: { kind: "identifier", name: "data" },
              },
            ],
          },
        ],
      })
    );
    expect(sol).toContain("function getHash(bytes32 data) public pure virtual returns (bytes32)");
  });

  it("should generate mapping with bytes32 key", () => {
    const sol = generateSolidity(
      emptyContract({
        variables: [
          {
            name: "commitments",
            type: {
              kind: SkittlesTypeKind.Mapping,
              keyType: { kind: SkittlesTypeKind.Bytes32 },
              valueType: { kind: SkittlesTypeKind.Address },
            },
            visibility: "private",
            immutable: false,
          },
        ],
      })
    );
    expect(sol).toContain("mapping(bytes32 => address) internal commitments;");
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

  it("should generate overload for function with default parameter", () => {
    const sol = generateSolidity(
      emptyContract({
        functions: [
          {
            name: "defaultParam",
            parameters: [
              {
                name: "x",
                type: { kind: SkittlesTypeKind.Uint256 },
                defaultValue: { kind: "number-literal", value: "10" },
              },
            ],
            returnType: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            stateMutability: "pure",
            isVirtual: true,
            isOverride: false,
            body: [
              {
                kind: "return",
                value: { kind: "identifier", name: "x" },
              },
            ],
          },
        ],
      })
    );
    // Main function with all params
    expect(sol).toContain("function defaultParam(uint256 x) public pure virtual returns (uint256)");
    // Overload without default params that forwards via local variable declarations
    // (widened to view since defaults may reference state/environment)
    expect(sol).toContain("function defaultParam() public view virtual returns (uint256)");
    expect(sol).toContain("uint256 x = 10;");
    expect(sol).toContain("return defaultParam(x);");
  });

  it("should generate multiple overloads for function with mixed default and required parameters", () => {
    const sol = generateSolidity(
      emptyContract({
        functions: [
          {
            name: "mixedParams",
            parameters: [
              { name: "a", type: { kind: SkittlesTypeKind.Uint256 } },
              {
                name: "b",
                type: { kind: SkittlesTypeKind.Uint256 },
                defaultValue: { kind: "number-literal", value: "5" },
              },
              {
                name: "c",
                type: { kind: SkittlesTypeKind.Uint256 },
                defaultValue: { kind: "number-literal", value: "10" },
              },
            ],
            returnType: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            stateMutability: "pure",
            isVirtual: true,
            isOverride: false,
            body: [
              {
                kind: "return",
                value: {
                  kind: "binary",
                  left: {
                    kind: "binary",
                    left: { kind: "identifier", name: "a" },
                    operator: "+",
                    right: { kind: "identifier", name: "b" },
                  },
                  operator: "+",
                  right: { kind: "identifier", name: "c" },
                },
              },
            ],
          },
        ],
      })
    );
    // Main function with all params
    expect(sol).toContain("function mixedParams(uint256 a, uint256 b, uint256 c) public pure virtual returns (uint256)");
    // Overload with just required param + first default
    expect(sol).toContain("function mixedParams(uint256 a, uint256 b) public view virtual returns (uint256)");
    expect(sol).toContain("uint256 c = 10;");
    expect(sol).toContain("return mixedParams(a, b, c);");
    // Overload with just required param
    expect(sol).toContain("function mixedParams(uint256 a) public view virtual returns (uint256)");
    expect(sol).toContain("uint256 b = 5;");
  });

  it("should throw when function has non-trailing default parameters", () => {
    expect(() =>
      generateSolidity(
        emptyContract({
          functions: [
            {
              name: "badDefaults",
              parameters: [
                {
                  name: "a",
                  type: { kind: SkittlesTypeKind.Uint256 },
                  defaultValue: { kind: "number-literal", value: "10" },
                },
                { name: "b", type: { kind: SkittlesTypeKind.Uint256 } },
              ],
              returnType: { kind: SkittlesTypeKind.Uint256 },
              visibility: "public",
              stateMutability: "pure",
              isVirtual: true,
              isOverride: false,
              body: [
                {
                  kind: "return",
                  value: { kind: "identifier", name: "b" },
                },
              ],
            },
          ],
        })
      )
    ).toThrow("default-valued parameters must be contiguous and trailing");
  });

  it("should inherit override/virtual on overloads for override function with defaults", () => {
    const sol = generateSolidity(
      emptyContract({
        functions: [
          {
            name: "overriddenFn",
            parameters: [
              { name: "a", type: { kind: SkittlesTypeKind.Uint256 } },
              {
                name: "b",
                type: { kind: SkittlesTypeKind.Uint256 },
                defaultValue: { kind: "number-literal", value: "42" },
              },
            ],
            returnType: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            stateMutability: "pure",
            isVirtual: false,
            isOverride: true,
            body: [
              {
                kind: "return",
                value: {
                  kind: "binary",
                  left: { kind: "identifier", name: "a" },
                  operator: "+",
                  right: { kind: "identifier", name: "b" },
                },
              },
            ],
          },
        ],
      })
    );
    // Main function keeps override
    expect(sol).toContain("function overriddenFn(uint256 a, uint256 b) public pure override returns (uint256)");
    // Overload inherits override from the original so it correctly participates
    // in inheritance when the parent also generates the shorter-arity overload.
    expect(sol).toContain("function overriddenFn(uint256 a) public view override returns (uint256)");
  });

  it("should throw when a parameter name shadows the function name with defaults", () => {
    expect(() =>
      generateSolidity(
        emptyContract({
          functions: [
            {
              name: "foo",
              parameters: [
                {
                  name: "foo",
                  type: { kind: SkittlesTypeKind.Uint256 },
                  defaultValue: { kind: "number-literal", value: "1" },
                },
              ],
              returnType: { kind: SkittlesTypeKind.Uint256 },
              visibility: "public",
              stateMutability: "pure",
              isVirtual: true,
              isOverride: false,
              body: [
                {
                  kind: "return",
                  value: { kind: "identifier", name: "foo" },
                },
              ],
            },
          ],
        })
      )
    ).toThrow("shadows the function name");
  });

  it("should generate concrete overloads for abstract function with defaults", () => {
    const sol = generateSolidity(
      emptyContract({
        isAbstract: true,
        functions: [
          {
            name: "abstractFn",
            parameters: [
              {
                name: "x",
                type: { kind: SkittlesTypeKind.Uint256 },
                defaultValue: { kind: "number-literal", value: "10" },
              },
            ],
            returnType: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            stateMutability: "pure",
            isVirtual: true,
            isOverride: false,
            isAbstract: true,
            body: [],
          },
        ],
      })
    );
    // Main function stays abstract (no body)
    expect(sol).toContain("function abstractFn(uint256 x) public pure virtual returns (uint256);");
    // Overload must be concrete (has body with forwarding call), not abstract
    expect(sol).toContain("function abstractFn() public view virtual returns (uint256)");
    expect(sol).not.toContain("function abstractFn() public view virtual returns (uint256);");
    expect(sol).toContain("uint256 x = 10;");
    expect(sol).toContain("return abstractFn(x);");
  });

  it("should handle overload local variable that shadows a sibling function name", () => {
    const sol = generateSolidity(
      emptyContract({
        functions: [
          {
            name: "value",
            parameters: [],
            returnType: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            stateMutability: "pure",
            isVirtual: true,
            isOverride: false,
            body: [
              {
                kind: "return",
                value: { kind: "number-literal", value: "42" },
              },
            ],
          },
          {
            name: "compute",
            parameters: [
              {
                name: "value",
                type: { kind: SkittlesTypeKind.Uint256 },
                defaultValue: { kind: "number-literal", value: "10" },
              },
            ],
            returnType: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            stateMutability: "pure",
            isVirtual: true,
            isOverride: false,
            body: [
              {
                kind: "return",
                value: { kind: "identifier", name: "value" },
              },
            ],
          },
        ],
      })
    );
    // The sibling function value() exists
    expect(sol).toContain("function value() public pure virtual returns (uint256)");
    // Main function: parameter "value" is renamed to avoid shadowing
    // the sibling function name (paramRenames mechanism)
    expect(sol).toContain("function compute(uint256 _value) public pure virtual returns (uint256)");
    // Overload: the generated local variable from the omitted default
    // keeps the original name since the forwarding call uses compute(),
    // not value(), so shadowing the sibling doesn't break anything
    expect(sol).toContain("function compute() public view virtual returns (uint256)");
    expect(sol).toContain("uint256 value = 10;");
    expect(sol).toContain("return compute(value);");
  });

  it("should widen overload to nonpayable when default expression contains a function call", () => {
    const sol = generateSolidity(
      emptyContract({
        functions: [
          {
            name: "compute",
            parameters: [
              {
                name: "x",
                type: { kind: SkittlesTypeKind.Uint256 },
                defaultValue: {
                  kind: "call",
                  callee: { kind: "identifier", name: "getDefault" },
                  args: [],
                },
              },
            ],
            returnType: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            stateMutability: "pure",
            isVirtual: true,
            isOverride: false,
            body: [
              {
                kind: "return",
                value: { kind: "identifier", name: "x" },
              },
            ],
          },
        ],
      })
    );
    // Main function stays pure
    expect(sol).toContain("function compute(uint256 x) public pure virtual returns (uint256)");
    // Overload widens to nonpayable (no mutability keyword) because the
    // default expression is a function call whose mutability is unknown.
    expect(sol).toContain("function compute() public virtual returns (uint256)");
    expect(sol).not.toContain("function compute() public view virtual");
    expect(sol).not.toContain("function compute() public pure virtual");
  });

  it("should widen overload to nonpayable when default expression contains ++/--", () => {
    const sol = generateSolidity(
      emptyContract({
        functions: [
          {
            name: "compute",
            parameters: [
              {
                name: "x",
                type: { kind: SkittlesTypeKind.Uint256 },
                defaultValue: {
                  kind: "unary",
                  operator: "++",
                  operand: { kind: "identifier", name: "counter" },
                  prefix: false,
                },
              },
            ],
            returnType: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            stateMutability: "pure",
            isVirtual: true,
            isOverride: false,
            body: [
              {
                kind: "return",
                value: { kind: "identifier", name: "x" },
              },
            ],
          },
        ],
      })
    );
    // Main function stays pure
    expect(sol).toContain("function compute(uint256 x) public pure virtual returns (uint256)");
    // Overload widens to nonpayable because ++ is state-modifying
    expect(sol).toContain("function compute() public virtual returns (uint256)");
    expect(sol).not.toContain("function compute() public view virtual");
    expect(sol).not.toContain("function compute() public pure virtual");
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
    expect(generateType({ kind: SkittlesTypeKind.Bytes32 })).toBe("bytes32");
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

  it("should escape non-printable ASCII in string literals", () => {
    const value = String.fromCharCode(0x19, 0x01);
    const result = generateExpression({ kind: "string-literal", value });
    expect(result).toBe('"\\x19\\x01"');
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

  it("should generate nullish coalescing as ternary with zero check", () => {
    const expr: Expression = {
      kind: "conditional",
      condition: {
        kind: "binary",
        operator: "==",
        left: { kind: "identifier", name: "x" },
        right: { kind: "number-literal", value: "0" },
      },
      whenTrue: { kind: "number-literal", value: "5" },
      whenFalse: { kind: "identifier", name: "x" },
    };
    expect(generateExpression(expr)).toBe("((x == 0) ? 5 : x)");
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

// ============================================================
// resolveShadowedLocals
// ============================================================

describe("resolveShadowedLocals", () => {
  it("should rename a local variable that shadows a state variable", () => {
    const body: Statement[] = [
      {
        kind: "variable-declaration",
        name: "result",
        type: { kind: SkittlesTypeKind.Uint256 },
        initializer: { kind: "number-literal", value: "0" },
      },
      {
        kind: "return",
        value: { kind: "identifier", name: "result" },
      },
    ];
    const stateVars = new Set(["result"]);
    const resolved = resolveShadowedLocals(body, stateVars);
    expect(resolved[0].kind).toBe("variable-declaration");
    if (resolved[0].kind === "variable-declaration") {
      expect(resolved[0].name).toBe("_result");
    }
    expect(resolved[1].kind).toBe("return");
    if (resolved[1].kind === "return" && resolved[1].value?.kind === "identifier") {
      expect(resolved[1].value.name).toBe("_result");
    }
  });

  it("should not rename local variables that do not shadow state variables", () => {
    const body: Statement[] = [
      {
        kind: "variable-declaration",
        name: "temp",
        type: { kind: SkittlesTypeKind.Uint256 },
        initializer: { kind: "number-literal", value: "5" },
      },
      {
        kind: "return",
        value: { kind: "identifier", name: "temp" },
      },
    ];
    const stateVars = new Set(["result"]);
    const resolved = resolveShadowedLocals(body, stateVars);
    expect(resolved[0].kind).toBe("variable-declaration");
    if (resolved[0].kind === "variable-declaration") {
      expect(resolved[0].name).toBe("temp");
    }
  });

  it("should rename local variables in nested blocks", () => {
    const body: Statement[] = [
      {
        kind: "if",
        condition: { kind: "boolean-literal", value: true },
        thenBody: [
          {
            kind: "variable-declaration",
            name: "count",
            type: { kind: SkittlesTypeKind.Uint256 },
            initializer: { kind: "number-literal", value: "0" },
          },
          {
            kind: "return",
            value: { kind: "identifier", name: "count" },
          },
        ],
      },
    ];
    const stateVars = new Set(["count"]);
    const resolved = resolveShadowedLocals(body, stateVars);
    const ifStmt = resolved[0];
    expect(ifStmt.kind).toBe("if");
    if (ifStmt.kind === "if") {
      const decl = ifStmt.thenBody[0];
      expect(decl.kind).toBe("variable-declaration");
      if (decl.kind === "variable-declaration") {
        expect(decl.name).toBe("_count");
      }
      const ret = ifStmt.thenBody[1];
      if (ret.kind === "return" && ret.value?.kind === "identifier") {
        expect(ret.value.name).toBe("_count");
      }
    }
  });

  it("should rename for-loop initializer that shadows a state variable", () => {
    const body: Statement[] = [
      {
        kind: "for",
        initializer: {
          kind: "variable-declaration",
          name: "index",
          type: { kind: SkittlesTypeKind.Uint256 },
          initializer: { kind: "number-literal", value: "0" },
        },
        condition: {
          kind: "binary",
          operator: "<",
          left: { kind: "identifier", name: "index" },
          right: { kind: "number-literal", value: "10" },
        },
        incrementor: {
          kind: "unary",
          operator: "++",
          operand: { kind: "identifier", name: "index" },
          prefix: false,
        },
        body: [
          {
            kind: "expression",
            expression: { kind: "identifier", name: "index" },
          },
        ],
      },
    ];
    const stateVars = new Set(["index"]);
    const resolved = resolveShadowedLocals(body, stateVars);
    const forStmt = resolved[0];
    expect(forStmt.kind).toBe("for");
    if (forStmt.kind === "for") {
      if (forStmt.initializer?.kind === "variable-declaration") {
        expect(forStmt.initializer.name).toBe("_index");
      }
      if (forStmt.condition?.kind === "binary" && forStmt.condition.left.kind === "identifier") {
        expect(forStmt.condition.left.name).toBe("_index");
      }
      if (forStmt.incrementor?.kind === "unary" && forStmt.incrementor.operand.kind === "identifier") {
        expect(forStmt.incrementor.operand.name).toBe("_index");
      }
    }
  });

  it("should handle name collision with underscore-prefixed state variable", () => {
    const body: Statement[] = [
      {
        kind: "variable-declaration",
        name: "x",
        type: { kind: SkittlesTypeKind.Uint256 },
      },
    ];
    // Both "x" and "_x" are state variables, so it should become "__x"
    const stateVars = new Set(["x", "_x"]);
    const resolved = resolveShadowedLocals(body, stateVars);
    if (resolved[0].kind === "variable-declaration") {
      expect(resolved[0].name).toBe("__x");
    }
  });

  it("should return body unchanged when no shadowing occurs", () => {
    const body: Statement[] = [
      {
        kind: "variable-declaration",
        name: "temp",
        type: { kind: SkittlesTypeKind.Uint256 },
      },
    ];
    const stateVars = new Set(["result"]);
    const resolved = resolveShadowedLocals(body, stateVars);
    expect(resolved).toBe(body); // same reference, not modified
  });

  it("should avoid collision with existing local variable names", () => {
    const body: Statement[] = [
      {
        kind: "variable-declaration",
        name: "_result",
        type: { kind: SkittlesTypeKind.Uint256 },
        initializer: { kind: "number-literal", value: "1" },
      },
      {
        kind: "variable-declaration",
        name: "result",
        type: { kind: SkittlesTypeKind.Uint256 },
        initializer: { kind: "number-literal", value: "2" },
      },
    ];
    // "result" shadows state var; "_result" already taken by local
    const stateVars = new Set(["result"]);
    const resolved = resolveShadowedLocals(body, stateVars);
    if (resolved[0].kind === "variable-declaration") {
      expect(resolved[0].name).toBe("_result"); // unchanged, not shadowed
    }
    if (resolved[1].kind === "variable-declaration") {
      expect(resolved[1].name).toBe("__result"); // skipped _result, went to __result
    }
  });

  it("should rename local variable in full contract generation", () => {
    const sol = generateSolidity(
      emptyContract({
        variables: [
          {
            name: "result",
            type: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            immutable: false,
            constant: false,
            initialValue: { kind: "number-literal", value: "0" },
          },
        ],
        functions: [
          {
            name: "testTernary",
            parameters: [
              { name: "x", type: { kind: SkittlesTypeKind.Uint256 } },
            ],
            returnType: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            stateMutability: "pure",
            isVirtual: true,
            isOverride: false,
            body: [
              {
                kind: "variable-declaration",
                name: "result",
                type: { kind: SkittlesTypeKind.Uint256 },
                initializer: {
                  kind: "conditional",
                  condition: {
                    kind: "binary",
                    operator: ">",
                    left: { kind: "identifier", name: "x" },
                    right: { kind: "number-literal", value: "0" },
                  },
                  whenTrue: { kind: "identifier", name: "x" },
                  whenFalse: { kind: "number-literal", value: "0" },
                },
              },
              {
                kind: "return",
                value: { kind: "identifier", name: "result" },
              },
            ],
          },
        ],
      })
    );
    // State variable should keep its name
    expect(sol).toContain("uint256 public result = 0;");
    // Local variable should be renamed
    expect(sol).toContain("uint256 _result =");
    expect(sol).toContain("return _result;");
    // Should NOT have shadowed local named "result" in the function body
    expect(sol).not.toMatch(/function testTernary[\s\S]*uint256 result =/);
  });

  it("should avoid collision with function parameter names", () => {
    const body: Statement[] = [
      {
        kind: "variable-declaration",
        name: "result",
        type: { kind: SkittlesTypeKind.Uint256 },
        initializer: { kind: "number-literal", value: "0" },
      },
      {
        kind: "return",
        value: { kind: "identifier", name: "result" },
      },
    ];
    // "result" shadows state var; "_result" is a parameter name
    const stateVars = new Set(["result"]);
    const paramNames = new Set(["_result"]);
    const resolved = resolveShadowedLocals(body, stateVars, paramNames);
    if (resolved[0].kind === "variable-declaration") {
      expect(resolved[0].name).toBe("__result"); // skipped _result (param), went to __result
    }
    if (resolved[1].kind === "return" && resolved[1].value?.kind === "identifier") {
      expect(resolved[1].value.name).toBe("__result");
    }
  });

  it("should rename local that shadows inherited state variable in multi-contract generation", () => {
    const parent = emptyContract({
      name: "Parent",
      variables: [
        {
          name: "balance",
          type: { kind: SkittlesTypeKind.Uint256 },
          visibility: "public",
          immutable: false,
          constant: false,
          initialValue: { kind: "number-literal", value: "0" },
        },
      ],
    });
    const child = emptyContract({
      name: "Child",
      inherits: ["Parent"],
      functions: [
        {
          name: "getBalance",
          parameters: [],
          returnType: { kind: SkittlesTypeKind.Uint256 },
          visibility: "public",
          stateMutability: "view",
          isVirtual: true,
          isOverride: false,
          body: [
            {
              kind: "variable-declaration",
              name: "balance",
              type: { kind: SkittlesTypeKind.Uint256 },
              initializer: { kind: "number-literal", value: "42" },
            },
            {
              kind: "return",
              value: { kind: "identifier", name: "balance" },
            },
          ],
        },
      ],
    });
    const sol = generateSolidityFile([parent, child]);
    // Local "balance" in child's function should be renamed to avoid
    // shadowing parent's state variable "balance"
    expect(sol).toContain("uint256 _balance = 42;");
    expect(sol).toContain("return _balance;");
  });

  it("should only rename references within the scope of the shadowed declaration", () => {
    // A block-scoped local "count" shadows a state var, but references to "count"
    // outside that block (e.g., referencing a parameter) should NOT be renamed.
    const body: Statement[] = [
      {
        kind: "expression",
        expression: { kind: "identifier", name: "count" },
      },
      {
        kind: "if",
        condition: { kind: "boolean-literal", value: true },
        thenBody: [
          {
            kind: "variable-declaration",
            name: "count",
            type: { kind: SkittlesTypeKind.Uint256 },
            initializer: { kind: "number-literal", value: "10" },
          },
          {
            kind: "expression",
            expression: { kind: "identifier", name: "count" },
          },
        ],
      },
      {
        kind: "expression",
        expression: { kind: "identifier", name: "count" },
      },
    ];
    const stateVars = new Set(["count"]);
    const resolved = resolveShadowedLocals(body, stateVars);

    // The first "count" reference (before the block) should NOT be renamed
    if (resolved[0].kind === "expression" && resolved[0].expression.kind === "identifier") {
      expect(resolved[0].expression.name).toBe("count");
    }

    // Inside the if-block, declaration and reference SHOULD be renamed
    const ifStmt = resolved[1];
    if (ifStmt.kind === "if") {
      if (ifStmt.thenBody[0].kind === "variable-declaration") {
        expect(ifStmt.thenBody[0].name).toBe("_count");
      }
      if (ifStmt.thenBody[1].kind === "expression" && ifStmt.thenBody[1].expression.kind === "identifier") {
        expect(ifStmt.thenBody[1].expression.name).toBe("_count");
      }
    }

    // The last "count" reference (after the block) should NOT be renamed
    if (resolved[2].kind === "expression" && resolved[2].expression.kind === "identifier") {
      expect(resolved[2].expression.name).toBe("count");
    }
  });

  it("should rename constructor default parameter that shadows a state variable", () => {
    const sol = generateSolidity(
      emptyContract({
        variables: [
          {
            name: "supply",
            type: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            immutable: false,
            constant: false,
            initialValue: { kind: "number-literal", value: "0" },
          },
        ],
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
                  property: "supply",
                },
                value: { kind: "identifier", name: "supply" },
              },
            },
          ],
        },
      })
    );
    // State variable should keep its name
    expect(sol).toContain("uint256 public supply = 0;");
    // Default param local should be renamed to avoid shadowing
    expect(sol).toContain("uint256 _supply = 1000000;");
    // Body reference should also be renamed
    expect(sol).toContain("supply = _supply;");
  });

  it("should rename references inside default parameter initializers when earlier param is renamed", () => {
    const sol = generateSolidity(
      emptyContract({
        variables: [
          {
            name: "supply",
            type: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            immutable: false,
            constant: false,
            initialValue: { kind: "number-literal", value: "0" },
          },
        ],
        ctor: {
          parameters: [
            {
              name: "supply",
              type: { kind: SkittlesTypeKind.Uint256 },
              defaultValue: { kind: "number-literal", value: "1000000" },
            },
            {
              name: "doubled",
              type: { kind: SkittlesTypeKind.Uint256 },
              defaultValue: {
                kind: "binary",
                operator: "*",
                left: { kind: "identifier", name: "supply" },
                right: { kind: "number-literal", value: "2" },
              },
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
                  property: "supply",
                },
                value: { kind: "identifier", name: "doubled" },
              },
            },
          ],
        },
      })
    );
    // Default param "supply" renamed to "_supply"
    expect(sol).toContain("uint256 _supply = 1000000;");
    // Later default param "doubled" should reference renamed "_supply"
    expect(sol).toContain("uint256 doubled = (_supply * 2);");
  });

  it("should not rename body local that re-declares a renamed default parameter name", () => {
    const sol = generateSolidity(
      emptyContract({
        variables: [
          {
            name: "supply",
            type: { kind: SkittlesTypeKind.Uint256 },
            visibility: "public",
            immutable: false,
            constant: false,
            initialValue: { kind: "number-literal", value: "0" },
          },
        ],
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
              kind: "variable-declaration",
              name: "supply",
              type: { kind: SkittlesTypeKind.Uint256 },
              initializer: {
                kind: "binary",
                operator: "*",
                left: { kind: "identifier", name: "supply" },
                right: { kind: "number-literal", value: "2" },
              },
            },
            {
              kind: "expression",
              expression: {
                kind: "assignment",
                operator: "=",
                target: {
                  kind: "property-access",
                  object: { kind: "identifier", name: "this" },
                  property: "supply",
                },
                value: { kind: "identifier", name: "supply" },
              },
            },
          ],
        },
      })
    );
    // Default param local should be renamed to avoid shadowing state var
    expect(sol).toContain("uint256 _supply = 1000000;");
    // Body local should NOT be renamed to _supply (which would collide).
    // The body local's initializer should reference the renamed default param.
    // resolveShadowedLocals will then rename this body local to avoid shadowing the state var.
    expect(sol).not.toMatch(/uint256 _supply = \(_supply/);
    // After the body local declaration, references should use the body local name
    expect(sol).toContain("supply =");
  });
});
