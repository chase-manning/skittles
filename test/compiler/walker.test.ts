import { describe, expect, it } from "vitest";

import type { ASTVisitor } from "../../src/compiler/walker";
import { filterStatements, walkExpression, walkStatements } from "../../src/compiler/walker";
import type { Expression, Statement } from "../../src/types/index";

// ============================================================
// walkExpression
// ============================================================

describe("walkExpression", () => {
  it("should visit a simple identifier", () => {
    const visited: string[] = [];
    const expr: Expression = { kind: "identifier", name: "x" };
    walkExpression(expr, {
      visitExpression(e) {
        visited.push(e.kind);
      },
    });
    expect(visited).toEqual(["identifier"]);
  });

  it("should visit all nodes in a binary expression", () => {
    const visited: string[] = [];
    const expr: Expression = {
      kind: "binary",
      operator: "+",
      left: { kind: "identifier", name: "a" },
      right: { kind: "number-literal", value: "1" },
    };
    walkExpression(expr, {
      visitExpression(e) {
        visited.push(e.kind);
      },
    });
    expect(visited).toEqual(["binary", "identifier", "number-literal"]);
  });

  it("should visit callee and args in a call expression", () => {
    const visited: string[] = [];
    const expr: Expression = {
      kind: "call",
      callee: { kind: "identifier", name: "foo" },
      args: [
        { kind: "number-literal", value: "1" },
        { kind: "identifier", name: "x" },
      ],
    };
    walkExpression(expr, {
      visitExpression(e) {
        visited.push(e.kind);
      },
    });
    expect(visited).toEqual(["call", "identifier", "number-literal", "identifier"]);
  });

  it("should visit nested property-access expressions", () => {
    const names: string[] = [];
    const expr: Expression = {
      kind: "property-access",
      object: { kind: "identifier", name: "this" },
      property: "balance",
    };
    walkExpression(expr, {
      visitExpression(e) {
        if (e.kind === "identifier") names.push(e.name);
      },
    });
    expect(names).toEqual(["this"]);
  });

  it("should visit conditional branches", () => {
    const visited: string[] = [];
    const expr: Expression = {
      kind: "conditional",
      condition: { kind: "boolean-literal", value: true },
      whenTrue: { kind: "number-literal", value: "1" },
      whenFalse: { kind: "number-literal", value: "2" },
    };
    walkExpression(expr, {
      visitExpression(e) {
        visited.push(e.kind);
      },
    });
    expect(visited).toEqual([
      "conditional",
      "boolean-literal",
      "number-literal",
      "number-literal",
    ]);
  });

  it("should not crash when no visitor callbacks are provided", () => {
    const expr: Expression = { kind: "identifier", name: "x" };
    expect(() => walkExpression(expr, {})).not.toThrow();
  });
});

// ============================================================
// walkStatements
// ============================================================

describe("walkStatements", () => {
  it("should visit statements and expressions", () => {
    const stmtKinds: string[] = [];
    const exprKinds: string[] = [];
    const stmts: Statement[] = [
      {
        kind: "variable-declaration",
        name: "x",
        type: null,
        initializer: { kind: "number-literal", value: "42" },
      },
    ];
    walkStatements(stmts, {
      visitStatement(s) {
        stmtKinds.push(s.kind);
      },
      visitExpression(e) {
        exprKinds.push(e.kind);
      },
    });
    expect(stmtKinds).toEqual(["variable-declaration"]);
    expect(exprKinds).toEqual(["number-literal"]);
  });

  it("should recurse into if-else bodies", () => {
    const stmtKinds: string[] = [];
    const stmts: Statement[] = [
      {
        kind: "if",
        condition: { kind: "boolean-literal", value: true },
        thenBody: [{ kind: "break" }],
        elseBody: [{ kind: "continue" }],
      },
    ];
    walkStatements(stmts, {
      visitStatement(s) {
        stmtKinds.push(s.kind);
      },
    });
    expect(stmtKinds).toEqual(["if", "break", "continue"]);
  });

  it("should recurse into for loop body and initializer", () => {
    const stmtKinds: string[] = [];
    const exprKinds: string[] = [];
    const stmts: Statement[] = [
      {
        kind: "for",
        initializer: {
          kind: "variable-declaration",
          name: "i",
          type: null,
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
          prefix: false,
          operand: { kind: "identifier", name: "i" },
        },
        body: [{ kind: "break" }],
      },
    ];
    walkStatements(stmts, {
      visitStatement(s) {
        stmtKinds.push(s.kind);
      },
      visitExpression(e) {
        exprKinds.push(e.kind);
      },
    });
    expect(stmtKinds).toEqual(["for", "variable-declaration", "break"]);
    expect(exprKinds).toContain("number-literal");
    expect(exprKinds).toContain("binary");
    expect(exprKinds).toContain("unary");
  });

  it("should recurse into while and do-while bodies", () => {
    const stmtKinds: string[] = [];
    const stmts: Statement[] = [
      {
        kind: "while",
        condition: { kind: "boolean-literal", value: true },
        body: [{ kind: "break" }],
      },
      {
        kind: "do-while",
        condition: { kind: "boolean-literal", value: false },
        body: [{ kind: "continue" }],
      },
    ];
    walkStatements(stmts, {
      visitStatement(s) {
        stmtKinds.push(s.kind);
      },
    });
    expect(stmtKinds).toEqual(["while", "break", "do-while", "continue"]);
  });

  it("should recurse into switch cases", () => {
    const stmtKinds: string[] = [];
    const stmts: Statement[] = [
      {
        kind: "switch",
        discriminant: { kind: "identifier", name: "x" },
        cases: [
          {
            value: { kind: "number-literal", value: "1" },
            body: [{ kind: "break" }],
          },
          {
            value: undefined,
            body: [{ kind: "continue" }],
          },
        ],
      },
    ];
    walkStatements(stmts, {
      visitStatement(s) {
        stmtKinds.push(s.kind);
      },
    });
    expect(stmtKinds).toEqual(["switch", "break", "continue"]);
  });

  it("should recurse into try-catch bodies", () => {
    const stmtKinds: string[] = [];
    const stmts: Statement[] = [
      {
        kind: "try-catch",
        call: { kind: "call", callee: { kind: "identifier", name: "foo" }, args: [] },
        successBody: [{ kind: "break" }],
        catchBody: [{ kind: "continue" }],
        catchParamName: "e",
      },
    ];
    walkStatements(stmts, {
      visitStatement(s) {
        stmtKinds.push(s.kind);
      },
    });
    expect(stmtKinds).toEqual(["try-catch", "break", "continue"]);
  });

  it("should visit return value expression", () => {
    const exprKinds: string[] = [];
    const stmts: Statement[] = [
      {
        kind: "return",
        value: { kind: "identifier", name: "result" },
      },
    ];
    walkStatements(stmts, {
      visitExpression(e) {
        exprKinds.push(e.kind);
      },
    });
    expect(exprKinds).toEqual(["identifier"]);
  });

  it("should visit emit args", () => {
    const names: string[] = [];
    const stmts: Statement[] = [
      {
        kind: "emit",
        eventName: "Transfer",
        args: [
          { kind: "identifier", name: "from" },
          { kind: "identifier", name: "to" },
        ],
      },
    ];
    walkStatements(stmts, {
      visitExpression(e) {
        if (e.kind === "identifier") names.push(e.name);
      },
    });
    expect(names).toEqual(["from", "to"]);
  });

  it("should visit delete target", () => {
    const exprKinds: string[] = [];
    const stmts: Statement[] = [
      {
        kind: "delete",
        target: { kind: "identifier", name: "x" },
      },
    ];
    walkStatements(stmts, {
      visitExpression(e) {
        exprKinds.push(e.kind);
      },
    });
    expect(exprKinds).toEqual(["identifier"]);
  });

  it("should visit revert message and custom error args", () => {
    const exprKinds: string[] = [];
    const stmts: Statement[] = [
      {
        kind: "revert",
        message: { kind: "string-literal", value: "error" },
        customErrorArgs: [{ kind: "number-literal", value: "1" }],
      },
    ];
    walkStatements(stmts, {
      visitExpression(e) {
        exprKinds.push(e.kind);
      },
    });
    expect(exprKinds).toEqual(["string-literal", "number-literal"]);
  });

  it("should visit console-log args", () => {
    const exprKinds: string[] = [];
    const stmts: Statement[] = [
      {
        kind: "console-log",
        args: [
          { kind: "string-literal", value: "hello" },
          { kind: "identifier", name: "x" },
        ],
      },
    ];
    walkStatements(stmts, {
      visitExpression(e) {
        exprKinds.push(e.kind);
      },
    });
    expect(exprKinds).toEqual(["string-literal", "identifier"]);
  });

  it("should not crash with empty visitor", () => {
    const stmts: Statement[] = [
      { kind: "break" },
      { kind: "continue" },
    ];
    expect(() => walkStatements(stmts, {})).not.toThrow();
  });

  it("should collect all identifiers in a complex statement tree", () => {
    const identifiers = new Set<string>();
    const stmts: Statement[] = [
      {
        kind: "variable-declaration",
        name: "x",
        type: null,
        initializer: {
          kind: "binary",
          operator: "+",
          left: { kind: "identifier", name: "a" },
          right: { kind: "identifier", name: "b" },
        },
      },
      {
        kind: "if",
        condition: { kind: "identifier", name: "flag" },
        thenBody: [
          {
            kind: "return",
            value: { kind: "identifier", name: "x" },
          },
        ],
      },
    ];
    walkStatements(stmts, {
      visitExpression(e) {
        if (e.kind === "identifier") identifiers.add(e.name);
      },
    });
    expect(identifiers).toEqual(new Set(["a", "b", "flag", "x"]));
  });
});

// ============================================================
// filterStatements
// ============================================================

describe("filterStatements", () => {
  it("should remove top-level statements matching the predicate", () => {
    const stmts: Statement[] = [
      { kind: "console-log", args: [{ kind: "string-literal", value: "hi" }] },
      { kind: "break" },
      { kind: "console-log", args: [] },
      { kind: "continue" },
    ];
    const result = filterStatements(stmts, (s) => s.kind === "console-log");
    expect(result.map((s) => s.kind)).toEqual(["break", "continue"]);
  });

  it("should remove statements nested inside if/else bodies", () => {
    const stmts: Statement[] = [
      {
        kind: "if",
        condition: { kind: "boolean-literal", value: true },
        thenBody: [
          { kind: "console-log", args: [] },
          { kind: "break" },
        ],
        elseBody: [
          { kind: "continue" },
          { kind: "console-log", args: [] },
        ],
      },
    ];
    const result = filterStatements(stmts, (s) => s.kind === "console-log");
    expect(result.length).toBe(1);
    const ifStmt = result[0];
    if (ifStmt.kind !== "if") throw new Error("expected if");
    expect(ifStmt.thenBody.map((s) => s.kind)).toEqual(["break"]);
    expect(ifStmt.elseBody?.map((s) => s.kind)).toEqual(["continue"]);
  });

  it("should remove statements nested inside for/while/do-while bodies", () => {
    const stmts: Statement[] = [
      {
        kind: "for",
        initializer: undefined,
        condition: undefined,
        incrementor: undefined,
        body: [
          { kind: "console-log", args: [] },
          { kind: "break" },
        ],
      },
      {
        kind: "while",
        condition: { kind: "boolean-literal", value: true },
        body: [
          { kind: "console-log", args: [] },
          { kind: "continue" },
        ],
      },
      {
        kind: "do-while",
        condition: { kind: "boolean-literal", value: false },
        body: [
          { kind: "console-log", args: [] },
          { kind: "break" },
        ],
      },
    ];
    const result = filterStatements(stmts, (s) => s.kind === "console-log");
    expect(result.length).toBe(3);
    for (const stmt of result) {
      if (stmt.kind === "for" || stmt.kind === "while" || stmt.kind === "do-while") {
        expect(stmt.body.every((s) => s.kind !== "console-log")).toBe(true);
        expect(stmt.body.length).toBe(1);
      }
    }
  });

  it("should remove statements nested inside switch cases", () => {
    const stmts: Statement[] = [
      {
        kind: "switch",
        discriminant: { kind: "identifier", name: "x" },
        cases: [
          {
            value: { kind: "number-literal", value: "1" },
            body: [
              { kind: "console-log", args: [] },
              { kind: "break" },
            ],
          },
        ],
      },
    ];
    const result = filterStatements(stmts, (s) => s.kind === "console-log");
    if (result[0].kind !== "switch") throw new Error("expected switch");
    expect(result[0].cases[0].body.map((s) => s.kind)).toEqual(["break"]);
  });

  it("should remove statements nested inside try-catch bodies", () => {
    const stmts: Statement[] = [
      {
        kind: "try-catch",
        call: { kind: "call", callee: { kind: "identifier", name: "foo" }, args: [] },
        successBody: [
          { kind: "console-log", args: [] },
          { kind: "break" },
        ],
        catchBody: [
          { kind: "console-log", args: [] },
          { kind: "continue" },
        ],
        catchParamName: "e",
      },
    ];
    const result = filterStatements(stmts, (s) => s.kind === "console-log");
    if (result[0].kind !== "try-catch") throw new Error("expected try-catch");
    expect(result[0].successBody.map((s) => s.kind)).toEqual(["break"]);
    expect(result[0].catchBody.map((s) => s.kind)).toEqual(["continue"]);
  });

  it("should return all statements when none match the predicate", () => {
    const stmts: Statement[] = [
      { kind: "break" },
      { kind: "continue" },
    ];
    const result = filterStatements(stmts, (s) => s.kind === "console-log");
    expect(result.map((s) => s.kind)).toEqual(["break", "continue"]);
  });
});
