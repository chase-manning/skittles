import {
  SkittlesTypeKind,
  type SkittlesContract,
  type SkittlesVariable,
  type SkittlesFunction,
  type SkittlesConstructor,
  type SkittlesEvent,
  type SkittlesType,
  type SkittlesContractInterface,
  type Statement,
  type Expression,
  type IfStatement,
  type RevertStatement,
  type Visibility,
  type SkittlesParameter,
} from "../types/index.ts";

// ============================================================
// Main entry
// ============================================================

/**
 * Generate a Solidity file containing multiple contracts.
 * Used when a single source file defines multiple classes (e.g., for inheritance).
 */
export function generateSolidityFile(contracts: SkittlesContract[], imports?: string[]): string {
  const parts: string[] = [];
  parts.push("// SPDX-License-Identifier: MIT");
  parts.push("pragma solidity ^0.8.20;");
  parts.push("");

  if (imports && imports.length > 0) {
    for (const imp of imports) {
      parts.push(`import "${imp}";`);
    }
    parts.push("");
  }

  // Collect and deduplicate contract interfaces across all contracts
  const allInterfaces: SkittlesContractInterface[] = [];
  const emittedInterfaces = new Set<string>();
  for (const contract of contracts) {
    for (const iface of contract.contractInterfaces ?? []) {
      if (!emittedInterfaces.has(iface.name)) {
        emittedInterfaces.add(iface.name);
        allInterfaces.push(iface);
      }
    }
  }

  // Hoist structs and enums referenced by interface signatures to file scope
  // so they are visible to the interface declarations.
  const hoistedStructs = new Set<string>();
  const hoistedEnums = new Set<string>();
  for (const iface of allInterfaces) {
    for (const fn of iface.functions) {
      collectReferencedTypeNames(fn.returnType, hoistedStructs, hoistedEnums);
      for (const p of fn.parameters) {
        collectReferencedTypeNames(p.type, hoistedStructs, hoistedEnums);
      }
    }
  }

  const emittedFileScopeTypes = new Set<string>();
  if (hoistedStructs.size > 0 || hoistedEnums.size > 0) {
    for (const contract of contracts) {
      for (const en of contract.enums ?? []) {
        if (hoistedEnums.has(en.name) && !emittedFileScopeTypes.has(en.name)) {
          emittedFileScopeTypes.add(en.name);
          parts.push(`enum ${en.name} { ${en.members.join(", ")} }`);
          parts.push("");
        }
      }
      for (const s of contract.structs ?? []) {
        if (hoistedStructs.has(s.name) && !emittedFileScopeTypes.has(s.name)) {
          emittedFileScopeTypes.add(s.name);
          parts.push(generateFileScopeStructDecl(s));
          parts.push("");
        }
      }
    }
  }

  for (const iface of allInterfaces) {
    parts.push(generateInterfaceDecl(iface));
    parts.push("");
  }

  for (let i = 0; i < contracts.length; i++) {
    parts.push(generateContractBody(contracts[i], emittedFileScopeTypes));
    if (i < contracts.length - 1) {
      parts.push("");
    }
  }

  parts.push("");
  return parts.join("\n");
}

export function generateSolidity(contract: SkittlesContract, imports?: string[]): string {
  return generateSolidityFile([contract], imports);
}

function generateContractBody(
  contract: SkittlesContract,
  fileScopeTypes: Set<string> = new Set()
): string {
  const parts: string[] = [];

  const inheritance =
    contract.inherits.length > 0
      ? ` is ${contract.inherits.join(", ")}`
      : "";
  parts.push(`contract ${contract.name}${inheritance} {`);

  for (const en of contract.enums ?? []) {
    if (fileScopeTypes.has(en.name)) continue;
    parts.push(`    enum ${en.name} { ${en.members.join(", ")} }`);
    parts.push("");
  }

  for (const ce of contract.customErrors ?? []) {
    const params = ce.parameters.map((p) => `${generateType(p.type)} ${p.name}`).join(", ");
    parts.push(`    error ${ce.name}(${params});`);
  }
  if ((contract.customErrors ?? []).length > 0) {
    parts.push("");
  }

  for (const s of contract.structs ?? []) {
    if (fileScopeTypes.has(s.name)) continue;
    parts.push(generateStructDecl(s));
    parts.push("");
  }

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

function generateStructDecl(s: { name: string; fields: SkittlesParameter[] }): string {
  const lines: string[] = [];
  lines.push(`    struct ${s.name} {`);
  for (const f of s.fields) {
    lines.push(`        ${generateType(f.type)} ${f.name};`);
  }
  lines.push("    }");
  return lines.join("\n");
}

function generateFileScopeStructDecl(s: { name: string; fields: SkittlesParameter[] }): string {
  const lines: string[] = [];
  lines.push(`struct ${s.name} {`);
  for (const f of s.fields) {
    lines.push(`    ${generateType(f.type)} ${f.name};`);
  }
  lines.push("}");
  return lines.join("\n");
}

function collectReferencedTypeNames(
  type: SkittlesType | null | undefined,
  structs: Set<string>,
  enums: Set<string>
): void {
  if (!type) return;
  if (type.kind === SkittlesTypeKind.Struct && type.structName) {
    structs.add(type.structName);
  } else if (type.kind === SkittlesTypeKind.Enum && type.structName) {
    enums.add(type.structName);
  } else if (type.kind === SkittlesTypeKind.Array && type.valueType) {
    collectReferencedTypeNames(type.valueType, structs, enums);
  } else if (type.kind === SkittlesTypeKind.Mapping) {
    collectReferencedTypeNames(type.keyType, structs, enums);
    collectReferencedTypeNames(type.valueType, structs, enums);
  } else if (type.kind === SkittlesTypeKind.Tuple && type.tupleTypes) {
    for (const t of type.tupleTypes) {
      collectReferencedTypeNames(t, structs, enums);
    }
  }
}

function generateInterfaceDecl(iface: SkittlesContractInterface): string {
  const lines: string[] = [];
  lines.push(`interface ${iface.name} {`);
  for (const f of iface.functions) {
    const params = f.parameters
      .map((p) => `${generateCalldataParamType(p.type)} ${p.name}`)
      .join(", ");
    const mut = f.stateMutability && f.stateMutability !== "nonpayable"
      ? ` ${f.stateMutability}`
      : "";
    let returns = "";
    if (f.returnType && f.returnType.kind !== SkittlesTypeKind.Void) {
      if (f.returnType.kind === SkittlesTypeKind.Tuple) {
        const tupleParams = (f.returnType.tupleTypes ?? []).map(generateParamType).join(", ");
        returns = ` returns (${tupleParams})`;
      } else {
        returns = ` returns (${generateParamType(f.returnType)})`;
      }
    }
    lines.push(`    function ${f.name}(${params}) external${mut}${returns};`);
  }
  lines.push("}");
  return lines.join("\n");
}

function generateEventDecl(e: SkittlesEvent): string {
  const params = e.parameters
    .map((p) => {
      const indexed = p.indexed ? " indexed" : "";
      return `${generateType(p.type)}${indexed} ${p.name}`;
    })
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
  let modifier = "";
  if (v.constant) {
    modifier = " constant";
  } else if (v.immutable && isValueType(v.type)) {
    modifier = " immutable";
  }

  const overrideStr = v.isOverride ? " override" : "";

  if (
    v.type.kind === SkittlesTypeKind.Mapping ||
    v.type.kind === SkittlesTypeKind.Array
  ) {
    return `${type} ${vis}${modifier}${overrideStr} ${v.name};`;
  }

  if (v.initialValue) {
    return `${type} ${vis}${modifier}${overrideStr} ${v.name} = ${generateExpression(v.initialValue)};`;
  }

  return `${type} ${vis}${modifier}${overrideStr} ${v.name};`;
}

function generateFunction(f: SkittlesFunction): string {
  if (f.name === "receive") {
    const lines: string[] = [];
    lines.push("    receive() external payable {");
    for (const s of f.body) {
      lines.push(generateStatement(s, "        "));
    }
    lines.push("    }");
    return lines.join("\n");
  }

  if (f.name === "fallback") {
    const lines: string[] = [];
    lines.push("    fallback() external payable {");
    for (const s of f.body) {
      lines.push(generateStatement(s, "        "));
    }
    lines.push("    }");
    return lines.join("\n");
  }

  const params = f.parameters
    .map((p) => `${generateParamType(p.type)} ${p.name}`)
    .join(", ");

  const vis = mapVisibility(f.visibility);
  const mut =
    f.stateMutability === "nonpayable" ? "" : f.stateMutability === "payable" ? " payable" : ` ${f.stateMutability}`;

  const virtOverride = f.isOverride ? " override" : f.isVirtual ? " virtual" : "";

  let returns = "";
  if (f.returnType && f.returnType.kind !== SkittlesTypeKind.Void) {
    if (f.returnType.kind === SkittlesTypeKind.Tuple) {
      const tupleParams = (f.returnType.tupleTypes ?? []).map(generateParamType).join(", ");
      returns = ` returns (${tupleParams})`;
    } else {
      returns = ` returns (${generateParamType(f.returnType)})`;
    }
  }

  const lines: string[] = [];
  lines.push(`    function ${f.name}(${params}) ${vis}${mut}${virtOverride}${returns} {`);
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
    case SkittlesTypeKind.Struct:
      return type.structName ?? "UnknownStruct";
    case SkittlesTypeKind.ContractInterface:
      return type.structName ?? "UnknownInterface";
    case SkittlesTypeKind.Enum:
      return type.structName ?? "UnknownEnum";
    case SkittlesTypeKind.Tuple:
      return `(${(type.tupleTypes ?? []).map(generateType).join(", ")})`;
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

function generateCalldataParamType(type: SkittlesType): string {
  const base = generateType(type);
  if (needsMemoryLocation(type)) {
    return `${base} calldata`;
  }
  return base;
}

function needsMemoryLocation(type: SkittlesType): boolean {
  return [
    SkittlesTypeKind.String,
    SkittlesTypeKind.Bytes,
    SkittlesTypeKind.Array,
    SkittlesTypeKind.Struct,
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
      if (/^0x[0-9a-fA-F]{40}$/.test(expr.value)) {
        return `address(${expr.value})`;
      }
      const escaped = expr.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    case "boolean-literal":
      return expr.value ? "true" : "false";
    case "identifier":
      if (expr.name === "self") return "address(this)";
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
      // Number.MAX_SAFE_INTEGER → 9007199254740991 (2^53 - 1)
      if (
        expr.object.kind === "identifier" &&
        expr.object.name === "Number" &&
        expr.property === "MAX_SAFE_INTEGER"
      ) {
        return "9007199254740991";
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
    case "call": {
      const callResult = tryGenerateBuiltinCall(expr);
      if (callResult) return callResult;
      return `${generateExpression(expr.callee)}(${expr.args.map(generateExpression).join(", ")})`;
    }
    case "conditional":
      return `(${generateExpression(expr.condition)} ? ${generateExpression(expr.whenTrue)} : ${generateExpression(expr.whenFalse)})`;
    case "new":
      return `new ${expr.callee}(${expr.args.map(generateExpression).join(", ")})`;
    case "object-literal": {
      const values = expr.properties.map((p) => generateExpression(p.value)).join(", ");
      return values;
    }
    case "tuple-literal":
      return `(${expr.elements.map(generateExpression).join(", ")})`;
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
        let initExpr = generateExpression(stmt.initializer);
        // Wrap object literal in struct constructor when the type is a struct
        if (stmt.initializer.kind === "object-literal" && stmt.type?.kind === SkittlesTypeKind.Struct) {
          initExpr = `${stmt.type.structName}(${initExpr})`;
        }
        return `${indent}${type} ${stmt.name} = ${initExpr};`;
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

    case "do-while": {
      const lines: string[] = [];
      lines.push(`${indent}do {`);
      for (const s of stmt.body) {
        lines.push(generateStatement(s, inner));
      }
      lines.push(
        `${indent}} while (${generateExpression(stmt.condition)});`
      );
      return lines.join("\n");
    }

    case "break":
      return `${indent}break;`;

    case "continue":
      return `${indent}continue;`;

    case "revert":
      if (stmt.customError) {
        const args = (stmt.customErrorArgs ?? []).map(generateExpression).join(", ");
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
        lines.push(`${indent}${keyword} (${discExpr} == ${generateExpression(c.value)}) {`);
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
      if (stmt.returnVarName && stmt.returnType && stmt.returnType.kind !== SkittlesTypeKind.Void) {
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

    default:
      return `${indent}// unsupported statement`;
  }
}

// ============================================================
// Require pattern optimization
// ============================================================

function isRequirePattern(stmt: IfStatement): boolean {
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
// Built-in function recognition
// ============================================================

function getCallName(expr: Expression): string | null {
  if (expr.kind === "identifier") return expr.name;
  if (
    expr.kind === "property-access" &&
    expr.object.kind === "identifier"
  ) {
    return `${expr.object.name}.${expr.property}`;
  }
  return null;
}

function tryGenerateBuiltinCall(expr: {
  callee: Expression;
  args: Expression[];
  typeArgs?: SkittlesType[];
}): string | null {
  const name = getCallName(expr.callee);
  if (!name) return null;
  const args = expr.args.map(generateExpression).join(", ");

  switch (name) {
    case "hash":
    case "keccak256":
      return `keccak256(abi.encodePacked(${args}))`;
    case "sha256":
      return `sha256(abi.encodePacked(${args}))`;
    case "abi.encode":
      return `abi.encode(${args})`;
    case "abi.encodePacked":
      return `abi.encodePacked(${args})`;
    case "abi.decode": {
      if (expr.typeArgs && expr.typeArgs.length > 0) {
        const types = expr.typeArgs.map(generateType).join(", ");
        return `abi.decode(${args}, (${types}))`;
      }
      return `abi.decode(${args})`;
    }
    case "ecrecover":
      return `ecrecover(${args})`;
    case "addmod":
      return `addmod(${args})`;
    case "mulmod":
      return `mulmod(${args})`;
    case "assert":
      return `assert(${args})`;
    case "gasleft":
      return `gasleft()`;
    case "string.concat":
      return `string.concat(${args})`;
    case "bytes.concat":
      return `bytes.concat(${args})`;
    default:
      return null;
  }
}

// ============================================================
// Visibility mapping (Skittles simplification)
// ============================================================

function mapVisibility(vis: Visibility): string {
  if (vis === "public") return "public";
  return "internal";
}
