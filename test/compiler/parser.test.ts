import { describe, it, expect } from "vitest";
import {
  parse,
  parseType,
  parseExpression,
  inferStateMutability,
} from "../../src/compiler/parser";
import ts from "typescript";

function makeTypeNode(code: string): ts.TypeNode {
  const src = ts.createSourceFile("t.ts", `let x: ${code};`, ts.ScriptTarget.Latest, true);
  const stmt = src.statements[0] as ts.VariableStatement;
  return stmt.declarationList.declarations[0].type!;
}

function makeExprNode(code: string): ts.Expression {
  const src = ts.createSourceFile("t.ts", `(${code});`, ts.ScriptTarget.Latest, true);
  const stmt = src.statements[0] as ts.ExpressionStatement;
  const paren = stmt.expression as ts.ParenthesizedExpression;
  return paren.expression;
}

// ============================================================
// parse() top level
// ============================================================

describe("parse", () => {
  it("should parse an empty class as a contract", () => {
    const contracts = parse("export class Empty {}", "test.ts");
    expect(contracts).toHaveLength(1);
    expect(contracts[0].name).toBe("Empty");
    expect(contracts[0].variables).toHaveLength(0);
    expect(contracts[0].functions).toHaveLength(0);
    expect(contracts[0].ctor).toBeUndefined();
  });

  it("should parse multiple classes", () => {
    const contracts = parse(
      "class A {} class B {}",
      "test.ts"
    );
    expect(contracts).toHaveLength(2);
    expect(contracts[0].name).toBe("A");
    expect(contracts[1].name).toBe("B");
  });

  it("should parse inheritance", () => {
    const contracts = parse(
      "class Token extends ERC20 {}",
      "test.ts"
    );
    expect(contracts[0].inherits).toEqual(["ERC20"]);
  });

  it("should parse state variables with types", () => {
    const contracts = parse(
      `class T {
        public x: number = 0;
        public name: string = "hello";
        public flag: boolean = true;
      }`,
      "test.ts"
    );
    const vars = contracts[0].variables;
    expect(vars).toHaveLength(3);
    expect(vars[0].name).toBe("x");
    expect(vars[0].type.kind).toBe("uint256");
    expect(vars[1].name).toBe("name");
    expect(vars[1].type.kind).toBe("string");
    expect(vars[2].name).toBe("flag");
    expect(vars[2].type.kind).toBe("bool");
  });

  it("should parse address typed variables", () => {
    const contracts = parse(
      `class T { public owner: address; }`,
      "test.ts"
    );
    expect(contracts[0].variables[0].type.kind).toBe("address");
  });

  it("should parse mapping variables", () => {
    const contracts = parse(
      `class T { private balances: Record<address, number> = {}; }`,
      "test.ts"
    );
    const v = contracts[0].variables[0];
    expect(v.type.kind).toBe("mapping");
    expect(v.type.keyType?.kind).toBe("address");
    expect(v.type.valueType?.kind).toBe("uint256");
    expect(v.initialValue).toBeUndefined();
  });

  it("should parse Map variables as mappings", () => {
    const contracts = parse(
      `class T { private balances: Map<address, number> = {}; }`,
      "test.ts"
    );
    const v = contracts[0].variables[0];
    expect(v.type.kind).toBe("mapping");
    expect(v.type.keyType?.kind).toBe("address");
    expect(v.type.valueType?.kind).toBe("uint256");
    expect(v.initialValue).toBeUndefined();
  });

  it("should parse nested mappings", () => {
    const contracts = parse(
      `class T { private allowances: Record<address, Record<address, number>> = {}; }`,
      "test.ts"
    );
    const v = contracts[0].variables[0];
    expect(v.type.kind).toBe("mapping");
    expect(v.type.valueType?.kind).toBe("mapping");
    expect(v.type.valueType?.keyType?.kind).toBe("address");
    expect(v.type.valueType?.valueType?.kind).toBe("uint256");
  });

  it("should parse nested Map types", () => {
    const contracts = parse(
      `class T { private allowances: Map<address, Map<address, number>> = {}; }`,
      "test.ts"
    );
    const v = contracts[0].variables[0];
    expect(v.type.kind).toBe("mapping");
    expect(v.type.valueType?.kind).toBe("mapping");
    expect(v.type.valueType?.keyType?.kind).toBe("address");
    expect(v.type.valueType?.valueType?.kind).toBe("uint256");
  });

  it("should parse visibility modifiers", () => {
    const contracts = parse(
      `class T {
        public a: number = 0;
        private b: number = 0;
        protected c: number = 0;
      }`,
      "test.ts"
    );
    const vars = contracts[0].variables;
    expect(vars[0].visibility).toBe("public");
    expect(vars[1].visibility).toBe("private");
    expect(vars[2].visibility).toBe("internal");
  });

  it("should parse readonly as immutable", () => {
    const contracts = parse(
      `class T { public readonly x: number = 42; }`,
      "test.ts"
    );
    expect(contracts[0].variables[0].immutable).toBe(true);
  });

  it("should parse constructor", () => {
    const contracts = parse(
      `class T {
        public x: number = 0;
        constructor(val: number) {
          this.x = val;
        }
      }`,
      "test.ts"
    );
    const ctor = contracts[0].ctor!;
    expect(ctor.parameters).toHaveLength(1);
    expect(ctor.parameters[0].name).toBe("val");
    expect(ctor.parameters[0].type.kind).toBe("uint256");
    expect(ctor.body).toHaveLength(1);
  });

  it("should parse a simple function", () => {
    const contracts = parse(
      `class T {
        public x: number = 0;
        public getX(): number {
          return this.x;
        }
      }`,
      "test.ts"
    );
    const fn = contracts[0].functions[0];
    expect(fn.name).toBe("getX");
    expect(fn.parameters).toHaveLength(0);
    expect(fn.returnType?.kind).toBe("uint256");
    expect(fn.visibility).toBe("public");
    expect(fn.stateMutability).toBe("view");
    expect(fn.body).toHaveLength(1);
  });

  it("should infer nonpayable for state-mutating functions", () => {
    const contracts = parse(
      `class T {
        public x: number = 0;
        public setX(val: number): void {
          this.x = val;
        }
      }`,
      "test.ts"
    );
    expect(contracts[0].functions[0].stateMutability).toBe("nonpayable");
  });

  it("should infer pure for functions that do not touch state", () => {
    const contracts = parse(
      `class T {
        public add(a: number, b: number): number {
          return a + b;
        }
      }`,
      "test.ts"
    );
    expect(contracts[0].functions[0].stateMutability).toBe("pure");
  });

  it("should parse event declarations", () => {
    const contracts = parse(
      `class T {
        Transfer: SkittlesEvent<{ from: address; to: address; value: number }>;
      }`,
      "test.ts"
    );
    expect(contracts[0].events).toHaveLength(1);
    expect(contracts[0].events[0].name).toBe("Transfer");
    expect(contracts[0].events[0].parameters).toHaveLength(3);
    expect(contracts[0].events[0].parameters[0].name).toBe("from");
    expect(contracts[0].events[0].parameters[0].type.kind).toBe("address");
    expect(contracts[0].events[0].parameters[2].name).toBe("value");
    expect(contracts[0].events[0].parameters[2].type.kind).toBe("uint256");
    // Events should NOT appear in variables
    expect(contracts[0].variables).toHaveLength(0);
  });

  it("should parse emit statements with object literal", () => {
    const contracts = parse(
      `class T {
        Transfer: SkittlesEvent<{ from: address; to: address; value: number }>;
        public doTransfer(): void {
          this.Transfer.emit({ from: msg.sender, to: msg.sender, value: 100 });
        }
      }`,
      "test.ts"
    );
    const fn = contracts[0].functions[0];
    expect(fn.body).toHaveLength(1);
    expect(fn.body[0].kind).toBe("emit");
    if (fn.body[0].kind === "emit") {
      expect(fn.body[0].eventName).toBe("Transfer");
      expect(fn.body[0].args).toHaveLength(3);
    }
  });

  it("should parse emit statements with shorthand properties", () => {
    const contracts = parse(
      `class T {
        Transfer: SkittlesEvent<{ from: address; to: address; amount: number }>;
        public doTransfer(from: address, to: address, amount: number): void {
          this.Transfer.emit({ from, to, amount });
        }
      }`,
      "test.ts"
    );
    const fn = contracts[0].functions[0];
    expect(fn.body[0].kind).toBe("emit");
    if (fn.body[0].kind === "emit") {
      expect(fn.body[0].args).toHaveLength(3);
      expect(fn.body[0].args[0]).toEqual({ kind: "identifier", name: "from" });
    }
  });

  it("should parse emit with positional arguments", () => {
    const contracts = parse(
      `class T {
        Transfer: SkittlesEvent<{ from: address; to: address; amount: number }>;
        public doTransfer(): void {
          this.Transfer.emit(msg.sender, msg.sender, 100);
        }
      }`,
      "test.ts"
    );
    const fn = contracts[0].functions[0];
    expect(fn.body[0].kind).toBe("emit");
    if (fn.body[0].kind === "emit") {
      expect(fn.body[0].args).toHaveLength(3);
    }
  });

  it("should detect emit as nonpayable (state mutating)", () => {
    const contracts = parse(
      `class T {
        Transfer: SkittlesEvent<{ from: address; to: address; amount: number }>;
        public doTransfer(): void {
          this.Transfer.emit(msg.sender, msg.sender, 100);
        }
      }`,
      "test.ts"
    );
    expect(contracts[0].functions[0].stateMutability).toBe("nonpayable");
  });
});

// ============================================================
// parseType
// ============================================================

describe("parseType", () => {
  it("should parse number as uint256", () => {
    expect(parseType(makeTypeNode("number")).kind).toBe("uint256");
  });

  it("should parse string as string", () => {
    expect(parseType(makeTypeNode("string")).kind).toBe("string");
  });

  it("should parse boolean as bool", () => {
    expect(parseType(makeTypeNode("boolean")).kind).toBe("bool");
  });

  it("should parse address type reference", () => {
    expect(parseType(makeTypeNode("address")).kind).toBe("address");
  });

  it("should parse void", () => {
    expect(parseType(makeTypeNode("void")).kind).toBe("void");
  });

  it("should parse Record as mapping", () => {
    const t = parseType(makeTypeNode("Record<address, number>"));
    expect(t.kind).toBe("mapping");
    expect(t.keyType?.kind).toBe("address");
    expect(t.valueType?.kind).toBe("uint256");
  });

  it("should parse Map as mapping", () => {
    const t = parseType(makeTypeNode("Map<address, number>"));
    expect(t.kind).toBe("mapping");
    expect(t.keyType?.kind).toBe("address");
    expect(t.valueType?.kind).toBe("uint256");
  });

  it("should parse number[] as array", () => {
    const t = parseType(makeTypeNode("number[]"));
    expect(t.kind).toBe("array");
    expect(t.valueType?.kind).toBe("uint256");
  });
});

// ============================================================
// parseExpression
// ============================================================

describe("parseExpression", () => {
  it("should parse number literal", () => {
    const expr = parseExpression(makeExprNode("42"));
    expect(expr).toEqual({ kind: "number-literal", value: "42" });
  });

  it("should parse string literal", () => {
    const expr = parseExpression(makeExprNode('"hello"'));
    expect(expr).toEqual({ kind: "string-literal", value: "hello" });
  });

  it("should parse boolean literals", () => {
    expect(parseExpression(makeExprNode("true"))).toEqual({
      kind: "boolean-literal",
      value: true,
    });
    expect(parseExpression(makeExprNode("false"))).toEqual({
      kind: "boolean-literal",
      value: false,
    });
  });

  it("should parse identifier", () => {
    const expr = parseExpression(makeExprNode("x"));
    expect(expr).toEqual({ kind: "identifier", name: "x" });
  });

  it("should parse this as identifier", () => {
    // Can't easily do just `this` as a standalone expression in a file context, so test via property access
    const expr = parseExpression(makeExprNode("this.x"));
    expect(expr.kind).toBe("property-access");
    if (expr.kind === "property-access") {
      expect(expr.object).toEqual({ kind: "identifier", name: "this" });
      expect(expr.property).toBe("x");
    }
  });

  it("should parse msg.sender as property access", () => {
    const expr = parseExpression(makeExprNode("msg.sender"));
    expect(expr.kind).toBe("property-access");
    if (expr.kind === "property-access") {
      expect(expr.object).toEqual({ kind: "identifier", name: "msg" });
      expect(expr.property).toBe("sender");
    }
  });

  it("should parse element access", () => {
    const expr = parseExpression(makeExprNode("arr[0]"));
    expect(expr.kind).toBe("element-access");
  });

  it("should parse binary expressions", () => {
    const expr = parseExpression(makeExprNode("a + b"));
    expect(expr.kind).toBe("binary");
    if (expr.kind === "binary") {
      expect(expr.operator).toBe("+");
    }
  });

  it("should map === to ==", () => {
    const expr = parseExpression(makeExprNode("a === b"));
    expect(expr.kind).toBe("binary");
    if (expr.kind === "binary") {
      expect(expr.operator).toBe("==");
    }
  });

  it("should parse assignment expressions", () => {
    const expr = parseExpression(makeExprNode("x = 5"));
    expect(expr.kind).toBe("assignment");
    if (expr.kind === "assignment") {
      expect(expr.operator).toBe("=");
    }
  });

  it("should parse compound assignments", () => {
    const expr = parseExpression(makeExprNode("x += 5"));
    expect(expr.kind).toBe("assignment");
    if (expr.kind === "assignment") {
      expect(expr.operator).toBe("+=");
    }
  });

  it("should parse prefix unary", () => {
    const expr = parseExpression(makeExprNode("!x"));
    expect(expr.kind).toBe("unary");
    if (expr.kind === "unary") {
      expect(expr.operator).toBe("!");
      expect(expr.prefix).toBe(true);
    }
  });

  it("should parse function calls", () => {
    const expr = parseExpression(makeExprNode("foo(1, 2)"));
    expect(expr.kind).toBe("call");
    if (expr.kind === "call") {
      expect(expr.args).toHaveLength(2);
    }
  });
});

// ============================================================
// inferStateMutability
// ============================================================

describe("inferStateMutability", () => {
  it("should return pure for empty body", () => {
    expect(inferStateMutability([])).toBe("pure");
  });

  it("should return view for state reads", () => {
    expect(
      inferStateMutability([
        {
          kind: "return",
          value: {
            kind: "property-access",
            object: { kind: "identifier", name: "this" },
            property: "x",
          },
        },
      ])
    ).toBe("view");
  });

  it("should return nonpayable for state writes", () => {
    expect(
      inferStateMutability([
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
            value: { kind: "number-literal", value: "5" },
          },
        },
      ])
    ).toBe("nonpayable");
  });

  it("should detect writes through mapping access", () => {
    expect(
      inferStateMutability([
        {
          kind: "expression",
          expression: {
            kind: "assignment",
            operator: "=",
            target: {
              kind: "element-access",
              object: {
                kind: "property-access",
                object: { kind: "identifier", name: "this" },
                property: "balances",
              },
              index: { kind: "identifier", name: "addr" },
            },
            value: { kind: "number-literal", value: "100" },
          },
        },
      ])
    ).toBe("nonpayable");
  });
});
