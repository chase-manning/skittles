import type {
  Expression,
  IfStatement,
  RevertStatement,
  Statement,
} from "../../types/index.ts";
import { SkittlesTypeKind } from "../../types/index.ts";
import { cctx } from "../codegen-context.ts";
import {
  generateExpression,
  generateParamType,
  generateType,
} from "./expressions.ts";

// ============================================================
// Statement generation
// ============================================================

/**
 * Check whether an expression refers to an enum-typed state variable.
 * Used to decide whether a uint256(...) cast is needed in return statements.
 */
function isEnumExpression(expr: Expression): boolean {
  // Direct identifier: `status` (state variable)
  if (expr.kind === "identifier") {
    return cctx.currentEnumStateVarNames.has(expr.name);
  }
  // Property access: `this.status`
  if (
    expr.kind === "property-access" &&
    expr.object.kind === "identifier" &&
    expr.object.name === "this"
  ) {
    return cctx.currentEnumStateVarNames.has(expr.property);
  }
  return false;
}

export function generateStatement(stmt: Statement, indent: string): string {
  const inner = indent + "    ";

  switch (stmt.kind) {
    case "return":
      if (stmt.value) {
        let retExpr = generateExpression(stmt.value);
        // When the function returns uint256 but the expression is an enum
        // state variable, emit an explicit uint256(...) cast so Solidity
        // doesn't reject the implicit enum→uint256 conversion.
        if (
          cctx.currentFunctionReturnType?.kind === SkittlesTypeKind.Uint256 &&
          isEnumExpression(stmt.value)
        ) {
          retExpr = `uint256(${retExpr})`;
        }
        return `${indent}return ${retExpr};`;
      }
      return `${indent}return;`;

    case "variable-declaration": {
      const type = stmt.type ? generateParamType(stmt.type) : "uint256";
      if (stmt.initializer) {
        let initExpr = generateExpression(stmt.initializer);
        // Wrap object literal in struct constructor when the type is a struct
        if (
          stmt.initializer.kind === "object-literal" &&
          stmt.type?.kind === SkittlesTypeKind.Struct
        ) {
          initExpr = `${stmt.type.structName}(${initExpr})`;
        }
        return `${indent}${type} ${stmt.name} = ${initExpr};`;
      }
      return `${indent}${type} ${stmt.name};`;
    }

    case "tuple-destructuring": {
      const parts = stmt.names.map((name, i) => {
        if (name === null) return "";
        const elemType = i < stmt.types.length ? stmt.types[i] : null;
        const type =
          elemType !== null ? generateParamType(elemType) : "uint256";
        return `${type} ${name}`;
      });
      const initExpr = generateExpression(stmt.initializer);
      return `${indent}(${parts.join(", ")}) = ${initExpr};`;
    }

    case "expression": {
      if (stmt.expression.kind === "conditional" && indent) {
        const conditionalExpr = stmt.expression;
        const lines: string[] = [];
        lines.push(
          `${indent}if (${generateExpression(conditionalExpr.condition)}) {`
        );
        lines.push(
          generateStatement(
            { kind: "expression", expression: conditionalExpr.whenTrue },
            inner
          )
        );
        lines.push(`${indent}} else {`);
        lines.push(
          generateStatement(
            { kind: "expression", expression: conditionalExpr.whenFalse },
            inner
          )
        );
        lines.push(`${indent}}`);
        return lines.join("\n");
      }
      return `${indent}${generateExpression(stmt.expression)};`;
    }

    case "if": {
      if (isRequirePattern(stmt)) {
        const negated = negateExpression(stmt.condition);
        const revert = stmt.thenBody[0] as RevertStatement;
        if (revert.message) {
          return `${indent}require(${generateExpression(negated)}, ${generateExpression(revert.message)});`;
        }
        return `${indent}require(${generateExpression(negated)});`;
      }

      const lines: string[] = [];
      lines.push(`${indent}if (${generateExpression(stmt.condition)}) {`);
      for (const s of stmt.thenBody) {
        lines.push(generateStatement(s, inner));
      }
      if (stmt.elseBody) {
        lines.push(`${indent}} else {`);
        for (const s of stmt.elseBody) {
          lines.push(generateStatement(s, inner));
        }
      }
      lines.push(`${indent}}`);
      return lines.join("\n");
    }

    case "for": {
      let initStr = "";
      if (stmt.initializer) {
        initStr = generateStatement(stmt.initializer, "").trimStart();
        if (initStr.endsWith(";")) {
          initStr = initStr.slice(0, -1);
        }
      }
      const condStr = stmt.condition ? generateExpression(stmt.condition) : "";
      const incrStr = stmt.incrementor
        ? generateExpression(stmt.incrementor)
        : "";

      const lines: string[] = [];
      lines.push(`${indent}for (${initStr}; ${condStr}; ${incrStr}) {`);
      for (const s of stmt.body) {
        lines.push(generateStatement(s, inner));
      }
      lines.push(`${indent}}`);
      return lines.join("\n");
    }

    case "while": {
      const lines: string[] = [];
      lines.push(`${indent}while (${generateExpression(stmt.condition)}) {`);
      for (const s of stmt.body) {
        lines.push(generateStatement(s, inner));
      }
      lines.push(`${indent}}`);
      return lines.join("\n");
    }

    case "do-while": {
      const lines: string[] = [];
      lines.push(`${indent}do {`);
      for (const s of stmt.body) {
        lines.push(generateStatement(s, inner));
      }
      lines.push(`${indent}} while (${generateExpression(stmt.condition)});`);
      return lines.join("\n");
    }

    case "break":
      return `${indent}break;`;

    case "continue":
      return `${indent}continue;`;

    case "revert":
      if (stmt.customError) {
        const args = (stmt.customErrorArgs ?? [])
          .map(generateExpression)
          .join(", ");
        return `${indent}revert ${stmt.customError}(${args});`;
      }
      if (stmt.message) {
        return `${indent}revert(${generateExpression(stmt.message)});`;
      }
      return `${indent}revert();`;

    case "emit":
      return `${indent}emit ${stmt.eventName}(${stmt.args.map(generateExpression).join(", ")});`;

    case "delete":
      return `${indent}delete ${generateExpression(stmt.target)};`;

    case "switch": {
      const lines: string[] = [];
      const discExpr = generateExpression(stmt.discriminant);
      let first = true;
      let defaultCase: Statement[] | undefined;

      for (const c of stmt.cases) {
        if (!c.value) {
          defaultCase = c.body;
          continue;
        }
        const keyword = first ? "if" : "} else if";
        lines.push(
          `${indent}${keyword} (${discExpr} == ${generateExpression(c.value)}) {`
        );
        for (const s of c.body) {
          lines.push(generateStatement(s, inner));
        }
        first = false;
      }

      if (defaultCase) {
        if (!first) {
          lines.push(`${indent}} else {`);
        } else {
          lines.push(`${indent}{`);
        }
        for (const s of defaultCase) {
          lines.push(generateStatement(s, inner));
        }
      }
      lines.push(`${indent}}`);
      return lines.join("\n");
    }

    case "try-catch": {
      const lines: string[] = [];
      const callExpr = generateExpression(stmt.call);
      let returns = "";
      if (
        stmt.returnVarName &&
        stmt.returnType &&
        stmt.returnType.kind !== SkittlesTypeKind.Void
      ) {
        returns = ` returns (${generateType(stmt.returnType)} ${stmt.returnVarName})`;
      }
      lines.push(`${indent}try ${callExpr}${returns} {`);
      for (const s of stmt.successBody) {
        lines.push(generateStatement(s, inner));
      }
      lines.push(`${indent}} catch {`);
      for (const s of stmt.catchBody) {
        lines.push(generateStatement(s, inner));
      }
      lines.push(`${indent}}`);
      return lines.join("\n");
    }

    case "console-log":
      return `${indent}console.log(${stmt.args.map(generateExpression).join(", ")});`;

    default: {
      const _exhaustive: never = stmt;
      throw new Error(`Unhandled statement kind: ${(_exhaustive as Statement).kind}`);
    }
  }
}

// ============================================================
// Require pattern optimization
// ============================================================

export function isRequirePattern(stmt: IfStatement): boolean {
  if (
    stmt.thenBody.length === 1 &&
    stmt.thenBody[0].kind === "revert" &&
    !stmt.elseBody
  ) {
    const revert = stmt.thenBody[0];
    if (revert.customError) return false;
    return true;
  }
  return false;
}

export function negateExpression(expr: Expression): Expression {
  if (expr.kind === "binary") {
    const negated = negateOperator(expr.operator);
    if (negated) {
      return { ...expr, operator: negated };
    }
  }
  return { kind: "unary", operator: "!", operand: expr, prefix: true };
}

function negateOperator(op: string): string | null {
  const map: Record<string, string> = {
    "<": ">=",
    ">": "<=",
    "<=": ">",
    ">=": "<",
    "==": "!=",
    "!=": "==",
  };
  return map[op] ?? null;
}
