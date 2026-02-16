import {
  SkittlesTypeKind,
  type SkittlesContract,
  type SkittlesVariable,
  type SkittlesFunction,
  type SkittlesConstructor,
  type SkittlesEvent,
  type SkittlesType,
  type Statement,
  type Expression,
  type IfStatement,
  type RevertStatement,
  type Visibility,
} from "../types";

// ============================================================
// Main entry
// ============================================================

/**
 * Generate a Solidity file containing multiple contracts.
 * Used when a single source file defines multiple classes (e.g., for inheritance).
 */
export function generateSolidityFile(contracts: SkittlesContract[]): string {
  const parts: string[] = [];
  parts.push("// SPDX-License-Identifier: MIT");
  parts.push("pragma solidity ^0.8.20;");
  parts.push("");

  for (let i = 0; i < contracts.length; i++) {
    parts.push(generateContractBody(contracts[i]));
    if (i < contracts.length - 1) {
      parts.push("");
    }
  }

  parts.push("");
  return parts.join("\n");
}

export function generateSolidity(contract: SkittlesContract): string {
  return generateSolidityFile([contract]);
}

function generateContractBody(contract: SkittlesContract): string {
  const parts: string[] = [];

  const inheritance =
    contract.inherits.length > 0
      ? ` is ${contract.inherits.join(", ")}`
      : "";
  parts.push(`contract ${contract.name}${inheritance} {`);

  for (const e of contract.events) {
    parts.push(`    ${generateEventDecl(e)}`);
  }

  if (contract.events.length > 0) {
    parts.push("");
  }

  for (const v of contract.variables) {
    parts.push(`    ${generateVariable(v)}`);
  }

  if (
    contract.variables.length > 0 &&
    (contract.ctor || contract.functions.length > 0)
  ) {
    parts.push("");
  }

  if (contract.ctor) {
    parts.push(generateConstructor(contract.ctor));
    if (contract.functions.length > 0) {
      parts.push("");
    }
  }

  for (let i = 0; i < contract.functions.length; i++) {
    parts.push(generateFunction(contract.functions[i]));
    if (i < contract.functions.length - 1) {
      parts.push("");
    }
  }

  parts.push("}");

  return parts.join("\n");
}

// ============================================================
// Contract elements
// ============================================================

function generateEventDecl(e: SkittlesEvent): string {
  const params = e.parameters
    .map((p) => `${generateType(p.type)} ${p.name}`)
    .join(", ");
  return `event ${e.name}(${params});`;
}

function isValueType(type: SkittlesType): boolean {
  return [
    SkittlesTypeKind.Uint256,
    SkittlesTypeKind.Int256,
    SkittlesTypeKind.Address,
    SkittlesTypeKind.Bool,
    SkittlesTypeKind.Bytes32,
  ].includes(type.kind);
}

function generateVariable(v: SkittlesVariable): string {
  const type = generateType(v.type);
  const vis = mapVisibility(v.visibility);
  const immut = v.immutable && isValueType(v.type) ? " immutable" : "";

  if (
    v.type.kind === SkittlesTypeKind.Mapping ||
    v.type.kind === SkittlesTypeKind.Array
  ) {
    return `${type} ${vis}${immut} ${v.name};`;
  }

  if (v.initialValue) {
    return `${type} ${vis}${immut} ${v.name} = ${generateExpression(v.initialValue)};`;
  }

  return `${type} ${vis}${immut} ${v.name};`;
}

function generateFunction(f: SkittlesFunction): string {
  const params = f.parameters
    .map((p) => `${generateParamType(p.type)} ${p.name}`)
    .join(", ");

  const vis = mapVisibility(f.visibility);
  const mut =
    f.stateMutability === "nonpayable" ? "" : f.stateMutability === "payable" ? " payable" : ` ${f.stateMutability}`;

  let returns = "";
  if (f.returnType && f.returnType.kind !== SkittlesTypeKind.Void) {
    returns = ` returns (${generateParamType(f.returnType)})`;
  }

  const lines: string[] = [];
  lines.push(`    function ${f.name}(${params}) ${vis}${mut}${returns} {`);
  for (const s of f.body) {
    lines.push(generateStatement(s, "        "));
  }
  lines.push("    }");

  return lines.join("\n");
}

function generateConstructor(c: SkittlesConstructor): string {
  const params = c.parameters
    .map((p) => `${generateParamType(p.type)} ${p.name}`)
    .join(", ");

  const lines: string[] = [];
  lines.push(`    constructor(${params}) {`);
  for (const s of c.body) {
    lines.push(generateStatement(s, "        "));
  }
  lines.push("    }");

  return lines.join("\n");
}

// ============================================================
// Type generation
// ============================================================

export function generateType(type: SkittlesType): string {
  switch (type.kind) {
    case SkittlesTypeKind.Uint256:
      return "uint256";
    case SkittlesTypeKind.Int256:
      return "int256";
    case SkittlesTypeKind.Address:
      return "address";
    case SkittlesTypeKind.Bool:
      return "bool";
    case SkittlesTypeKind.String:
      return "string";
    case SkittlesTypeKind.Bytes32:
      return "bytes32";
    case SkittlesTypeKind.Bytes:
      return "bytes";
    case SkittlesTypeKind.Mapping:
      return `mapping(${generateType(type.keyType!)} => ${generateType(type.valueType!)})`;
    case SkittlesTypeKind.Array:
      return `${generateType(type.valueType!)}[]`;
    case SkittlesTypeKind.Void:
      return "";
    default:
      return "uint256";
  }
}

function generateParamType(type: SkittlesType): string {
  const base = generateType(type);
  if (needsMemoryLocation(type)) {
    return `${base} memory`;
  }
  return base;
}

function needsMemoryLocation(type: SkittlesType): boolean {
  return [
    SkittlesTypeKind.String,
    SkittlesTypeKind.Bytes,
    SkittlesTypeKind.Array,
  ].includes(type.kind);
}

// ============================================================
// Expression generation
// ============================================================

export function generateExpression(expr: Expression): string {
  switch (expr.kind) {
    case "number-literal":
      return expr.value;
    case "string-literal": {
      const escaped = expr.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    case "boolean-literal":
      return expr.value ? "true" : "false";
    case "identifier":
      return expr.name;
    case "property-access":
      if (
        expr.object.kind === "identifier" &&
        expr.object.name === "this"
      ) {
        return expr.property;
      }
      // Number.MAX_VALUE → type(uint256).max
      if (
        expr.object.kind === "identifier" &&
        expr.object.name === "Number" &&
        expr.property === "MAX_VALUE"
      ) {
        return "type(uint256).max";
      }
      return `${generateExpression(expr.object)}.${expr.property}`;
    case "element-access":
      return `${generateExpression(expr.object)}[${generateExpression(expr.index)}]`;
    case "binary":
      return `(${generateExpression(expr.left)} ${expr.operator} ${generateExpression(expr.right)})`;
    case "unary":
      if (expr.prefix) {
        return `${expr.operator}${generateExpression(expr.operand)}`;
      }
      return `${generateExpression(expr.operand)}${expr.operator}`;
    case "assignment":
      return `${generateExpression(expr.target)} ${expr.operator} ${generateExpression(expr.value)}`;
    case "call":
      return `${generateExpression(expr.callee)}(${expr.args.map(generateExpression).join(", ")})`;
    case "conditional":
      return `(${generateExpression(expr.condition)} ? ${generateExpression(expr.whenTrue)} : ${generateExpression(expr.whenFalse)})`;
    case "new":
      return `new ${expr.callee}(${expr.args.map(generateExpression).join(", ")})`;
    default:
      return "/* unsupported */";
  }
}

// ============================================================
// Statement generation
// ============================================================

export function generateStatement(stmt: Statement, indent: string): string {
  const inner = indent + "    ";

  switch (stmt.kind) {
    case "return":
      if (stmt.value) {
        return `${indent}return ${generateExpression(stmt.value)};`;
      }
      return `${indent}return;`;

    case "variable-declaration": {
      const type = stmt.type ? generateParamType(stmt.type) : "uint256";
      if (stmt.initializer) {
        return `${indent}${type} ${stmt.name} = ${generateExpression(stmt.initializer)};`;
      }
      return `${indent}${type} ${stmt.name};`;
    }

    case "expression":
      return `${indent}${generateExpression(stmt.expression)};`;

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
      lines.push(
        `${indent}if (${generateExpression(stmt.condition)}) {`
      );
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
      const condStr = stmt.condition
        ? generateExpression(stmt.condition)
        : "";
      const incrStr = stmt.incrementor
        ? generateExpression(stmt.incrementor)
        : "";

      const lines: string[] = [];
      lines.push(
        `${indent}for (${initStr}; ${condStr}; ${incrStr}) {`
      );
      for (const s of stmt.body) {
        lines.push(generateStatement(s, inner));
      }
      lines.push(`${indent}}`);
      return lines.join("\n");
    }

    case "while": {
      const lines: string[] = [];
      lines.push(
        `${indent}while (${generateExpression(stmt.condition)}) {`
      );
      for (const s of stmt.body) {
        lines.push(generateStatement(s, inner));
      }
      lines.push(`${indent}}`);
      return lines.join("\n");
    }

    case "revert":
      if (stmt.message) {
        return `${indent}revert(${generateExpression(stmt.message)});`;
      }
      return `${indent}revert();`;

    case "emit":
      return `${indent}emit ${stmt.eventName}(${stmt.args.map(generateExpression).join(", ")});`;

    default:
      return `${indent}// unsupported statement`;
  }
}

// ============================================================
// Require pattern optimization
// ============================================================

function isRequirePattern(stmt: IfStatement): boolean {
  return (
    stmt.thenBody.length === 1 &&
    stmt.thenBody[0].kind === "revert" &&
    !stmt.elseBody
  );
}

function negateExpression(expr: Expression): Expression {
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

// ============================================================
// Visibility mapping (Skittles simplification)
// ============================================================

function mapVisibility(vis: Visibility): string {
  if (vis === "public") return "public";
  return "internal";
}
