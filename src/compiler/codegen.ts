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
  type SourceMapping,
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

  // Add Hardhat console import if any contract uses console.log
  const needsConsoleImport = contracts.some(contractUsesConsoleLog);
  if (needsConsoleImport) {
    parts.push('import "hardhat/console.sol";');
  }

  if (imports && imports.length > 0) {
    for (const imp of imports) {
      parts.push(`import "${imp}";`);
    }
  }

  if (needsConsoleImport || (imports && imports.length > 0)) {
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

  // Build per-contract ancestor sets so deduplication only applies when the
  // current contract inherits from the contract that first emitted a definition.
  const contractByName = new Map(contracts.map((c) => [c.name, c] as const));
  const ancestorsMap = new Map<string, Set<string>>();
  for (const contract of contracts) {
    const ancestors = new Set<string>();
    const queue = [...contract.inherits.filter((n) => contractByName.has(n))];
    let queueIndex = 0;
    while (queueIndex < queue.length) {
      const name = queue[queueIndex++]!;
      if (ancestors.has(name)) continue;
      ancestors.add(name);
      const parent = contractByName.get(name);
      if (parent) {
        for (const gp of parent.inherits) {
          if (contractByName.has(gp)) queue.push(gp);
        }
      }
    }
    ancestorsMap.set(contract.name, ancestors);
  }

  // Track all contracts that emitted each definition / function so child
  // contracts that inherit from any of those origins can skip re-emission.
  const definitionOrigins = new Map<string, Set<string>>();
  const functionOrigins = new Map<string, Set<string>>();
  for (let i = 0; i < contracts.length; i++) {
    const ancestors = ancestorsMap.get(contracts[i].name)!;
    parts.push(
      generateContractBody(
        contracts[i],
        emittedFileScopeTypes,
        definitionOrigins,
        functionOrigins,
        ancestors
      )
    );
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
  fileScopeTypes: Set<string> = new Set(),
  definitionOrigins: Map<string, Set<string>> = new Map(),
  functionOrigins: Map<string, Set<string>> = new Map(),
  ancestors: Set<string> = new Set()
): string {
  const parts: string[] = [];

  const inheritance =
    contract.inherits.length > 0
      ? ` is ${contract.inherits.join(", ")}`
      : "";
  const abstractPrefix = contract.isAbstract ? "abstract " : "";
  parts.push(`${abstractPrefix}contract ${contract.name}${inheritance} {`);

  const hasAncestorOrigin = (origins: Set<string> | undefined): boolean =>
    origins !== undefined && Array.from(origins).some((o) => ancestors.has(o));

  const addOrigin = (map: Map<string, Set<string>>, key: string): void => {
    let origins = map.get(key);
    if (!origins) {
      origins = new Set<string>();
      map.set(key, origins);
    }
    origins.add(contract.name);
  };

  for (const en of contract.enums ?? []) {
    if (fileScopeTypes.has(en.name)) continue;
    if (hasAncestorOrigin(definitionOrigins.get(en.name))) continue;
    addOrigin(definitionOrigins, en.name);
    parts.push(`    enum ${en.name} { ${en.members.join(", ")} }`);
    parts.push("");
  }

  let emittedCustomErrorCount = 0;
  for (const ce of contract.customErrors ?? []) {
    if (hasAncestorOrigin(definitionOrigins.get(ce.name))) continue;
    addOrigin(definitionOrigins, ce.name);
    const params = ce.parameters.map((p) => `${generateType(p.type)} ${p.name}`).join(", ");
    parts.push(`    error ${ce.name}(${params});`);
    emittedCustomErrorCount++;
  }
  if (emittedCustomErrorCount > 0) {
    parts.push("");
  }

  for (const s of contract.structs ?? []) {
    if (fileScopeTypes.has(s.name)) continue;
    if (hasAncestorOrigin(definitionOrigins.get(s.name))) continue;
    addOrigin(definitionOrigins, s.name);
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

  const readonlyArrayVars = contract.variables.filter(
    (v) => v.immutable && v.type.kind === SkittlesTypeKind.Array
  );

  // Skip functions already emitted by an ancestor contract in the same file
  // (shared file-level functions injected into both parent and child), unless
  // the child explicitly overrides them.  Use a full signature key (name +
  // full parameter types) so overloads are not incorrectly suppressed.
  const getFunctionKey = (f: SkittlesFunction): string => {
    const paramTypes = f.parameters
      .map((p) => (p.type ? generateType(p.type) : "unknown"))
      .join(",");
    return `${f.name}(${paramTypes})`;
  };
  const functionsToEmit = contract.functions.filter((f) => {
    const key = getFunctionKey(f);
    return !hasAncestorOrigin(functionOrigins.get(key)) || f.isOverride;
  });
  for (const f of functionsToEmit) {
    addOrigin(functionOrigins, getFunctionKey(f));
  }

  if (
    contract.variables.length > 0 &&
    (contract.ctor || functionsToEmit.length > 0 || readonlyArrayVars.length > 0)
  ) {
    parts.push("");
  }

  if (contract.ctor) {
    parts.push(generateConstructor(contract.ctor));
    if (functionsToEmit.length > 0 || readonlyArrayVars.length > 0) {
      parts.push("");
    }
  }

  for (let i = 0; i < functionsToEmit.length; i++) {
    parts.push(generateFunction(functionsToEmit[i]));
    if (i < functionsToEmit.length - 1 || readonlyArrayVars.length > 0) {
      parts.push("");
    }
  }

  for (let i = 0; i < readonlyArrayVars.length; i++) {
    parts.push(generateReadonlyArrayGetter(readonlyArrayVars[i]));
    if (i < readonlyArrayVars.length - 1) {
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
  const isReadonlyArray = v.immutable && v.type.kind === SkittlesTypeKind.Array;
  const vis = isReadonlyArray ? "internal" : mapVisibility(v.visibility);
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

function generateReadonlyArrayGetter(v: SkittlesVariable): string {
  const type = generateType(v.type);
  const name = v.name;
  const getterName = `get${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  const lines: string[] = [];
  lines.push(`    function ${getterName}() public view returns (${type} memory) {`);
  lines.push(`        return ${name};`);
  lines.push("    }");
  return lines.join("\n");
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
  if (f.isAbstract) {
    lines.push(`    function ${f.name}(${params}) ${vis}${mut}${virtOverride}${returns};`);
  } else {
    lines.push(`    function ${f.name}(${params}) ${vis}${mut}${virtOverride}${returns} {`);
    for (const s of f.body) {
      lines.push(generateStatement(s, "        "));
    }
    lines.push("    }");
  }
  return lines.join("\n");
}

function generateConstructor(c: SkittlesConstructor): string {
  const regularParams = c.parameters.filter((p) => !p.defaultValue);
  const defaultParams = c.parameters.filter((p) => p.defaultValue);

  const params = regularParams
    .map((p) => `${generateParamType(p.type)} ${p.name}`)
    .join(", ");

  const lines: string[] = [];
  lines.push(`    constructor(${params}) {`);
  for (const p of defaultParams) {
    lines.push(`        ${generateParamType(p.type)} ${p.name} = ${generateExpression(p.defaultValue!)};`);
  }
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
      // addr.transfer(amount) → payable(addr).transfer(amount)
      // Exclude this.transfer(...) (internal call) and this.stateVar.transfer(...)
      // (external contract interface call) to avoid misclassifying non-ETH transfers.
      if (
        expr.callee.kind === "property-access" &&
        expr.callee.property === "transfer" &&
        expr.args.length === 1 &&
        !isThisOrContractCall(expr.callee.object)
      ) {
        const addr = generateExpression(expr.callee.object);
        return `payable(${addr}).transfer(${generateExpression(expr.args[0])})`;
      }
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

    case "console-log":
      return `${indent}console.log(${stmt.args.map(generateExpression).join(", ")});`;

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

/**
 * Check if a receiver expression is `this` (an internal contract method call).
 * Used to avoid wrapping `this.transfer(...)` calls in `payable(...)`.
 * Note: `this.stateVar.transfer(amount)` is NOT excluded here because
 * codegen strips `this.` and the arg count (1 for ETH transfer vs 2+ for
 * contract interface calls) serves as the discriminator.
 */
function isThisOrContractCall(receiver: Expression): boolean {
  return receiver.kind === "identifier" && receiver.name === "this";
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
    case "Contract":
      if (expr.typeArgs && expr.typeArgs.length > 0 && expr.typeArgs[0].kind === SkittlesTypeKind.ContractInterface && expr.typeArgs[0].structName) {
        return `${expr.typeArgs[0].structName}(${args})`;
      }
      throw new Error("Contract<T>() requires a contract interface type argument, e.g. Contract<IToken>(address)");
    case "string.concat":
      return `string.concat(${args})`;
    case "bytes.concat":
      return `bytes.concat(${args})`;
    default:
      return null;
  }
}

// ============================================================
// Console.log detection
// ============================================================

function statementsUseConsoleLog(stmts: Statement[]): boolean {
  for (const stmt of stmts) {
    if (stmt.kind === "console-log") return true;
    if (stmt.kind === "if") {
      if (statementsUseConsoleLog(stmt.thenBody)) return true;
      if (stmt.elseBody && statementsUseConsoleLog(stmt.elseBody)) return true;
    }
    if (stmt.kind === "for" || stmt.kind === "while" || stmt.kind === "do-while") {
      if (statementsUseConsoleLog(stmt.body)) return true;
    }
    if (stmt.kind === "switch") {
      for (const c of stmt.cases) {
        if (statementsUseConsoleLog(c.body)) return true;
      }
    }
    if (stmt.kind === "try-catch") {
      if (statementsUseConsoleLog(stmt.successBody)) return true;
      if (statementsUseConsoleLog(stmt.catchBody)) return true;
    }
  }
  return false;
}

function contractUsesConsoleLog(contract: SkittlesContract): boolean {
  for (const f of contract.functions) {
    if (statementsUseConsoleLog(f.body)) return true;
  }
  if (contract.ctor && statementsUseConsoleLog(contract.ctor.body)) return true;
  return false;
}

// ============================================================
// Visibility mapping (Skittles simplification)
// ============================================================

function mapVisibility(vis: Visibility): string {
  if (vis === "public") return "public";
  return "internal";
}

// ============================================================
// Source map generation
// ============================================================

/**
 * Build a source map that maps generated Solidity line numbers
 * back to TypeScript source line numbers.
 *
 * The mapping is built by walking the IR (which has source line info
 * from the parser) and counting lines in the generated Solidity output
 * to correlate each Solidity line with its TypeScript origin.
 */
export function buildSourceMap(
  solidity: string,
  contracts: SkittlesContract[],
  sourceFile: string
): SourceMapping {
  const solLines = solidity.split("\n");
  const mappings: Record<number, number> = {};

  let lineIdx = 0; // 0-based index into solLines

  // Helper: find the next line matching a test, starting from lineIdx
  function findLine(test: (line: string) => boolean): number {
    for (let i = lineIdx; i < solLines.length; i++) {
      if (test(solLines[i])) {
        lineIdx = i;
        return i;
      }
    }
    return -1;
  }

  function addMapping(solLineIdx: number, tsLine: number | undefined): void {
    if (tsLine !== undefined && solLineIdx >= 0) {
      mappings[solLineIdx + 1] = tsLine; // convert to 1-based
    }
  }

  /**
   * Map function/constructor body statements to Solidity lines.
   * Walks statements in order, using generateStatement to count lines
   * for each statement so we know exactly where each one appears.
   */
  function mapBodyStatements(
    body: Statement[],
    startLineIdx: number,
    indent: string
  ): void {
    let currentIdx = startLineIdx;
    for (const stmt of body) {
      addMapping(currentIdx, stmt.sourceLine);
      const stmtText = generateStatement(stmt, indent);
      const stmtLineCount = stmtText.split("\n").length;

      // Recurse into compound statement bodies
      if (stmt.kind === "if" && !isRequirePattern(stmt)) {
        // Line 0: if (cond) {
        mapBodyStatements(stmt.thenBody, currentIdx + 1, indent + "    ");
        if (stmt.elseBody) {
          const thenLineCount = stmt.thenBody.reduce(
            (sum, s) => sum + generateStatement(s, indent + "    ").split("\n").length,
            0
          );
          // } else { is at currentIdx + 1 + thenLineCount
          mapBodyStatements(
            stmt.elseBody,
            currentIdx + 1 + thenLineCount + 1,
            indent + "    "
          );
        }
      } else if (stmt.kind === "for" || stmt.kind === "while") {
        mapBodyStatements(stmt.body, currentIdx + 1, indent + "    ");
      } else if (stmt.kind === "do-while") {
        mapBodyStatements(stmt.body, currentIdx + 1, indent + "    ");
      }

      currentIdx += stmtLineCount;
    }
  }

  for (const contract of contracts) {
    // Find the contract declaration line
    const contractIdx = findLine((l) => {
      const trimmed = l.trimStart();
      return trimmed.startsWith(`contract ${contract.name}`) || trimmed.startsWith(`abstract contract ${contract.name}`);
    });
    if (contractIdx === -1) continue;
    addMapping(contractIdx, contract.sourceLine);
    lineIdx = contractIdx + 1;

    // Map events
    for (const e of contract.events) {
      const idx = findLine((l) => {
        const trimmed = l.trim();
        return trimmed.startsWith(`event ${e.name}(`);
      });
      if (idx !== -1) {
        addMapping(idx, e.sourceLine);
        lineIdx = idx + 1;
      }
    }

    // Map variables
    for (const v of contract.variables) {
      const idx = findLine((l) => {
        const trimmed = l.trim();
        return trimmed.includes(` ${v.name}`) && trimmed.endsWith(";");
      });
      if (idx !== -1) {
        addMapping(idx, v.sourceLine);
        lineIdx = idx + 1;
      }
    }

    // Map constructor
    if (contract.ctor) {
      const ctorIdx = findLine((l) => l.trim().startsWith("constructor("));
      if (ctorIdx !== -1) {
        addMapping(ctorIdx, contract.ctor.sourceLine);
        lineIdx = ctorIdx + 1;
        mapBodyStatements(contract.ctor.body, lineIdx, "        ");
      }
    }

    // Map functions
    for (const f of contract.functions) {
      const funcIdx = findLine((l) => {
        const trimmed = l.trim();
        if (f.name === "receive") return trimmed.startsWith("receive()");
        if (f.name === "fallback") return trimmed.startsWith("fallback()");
        return trimmed.startsWith(`function ${f.name}(`);
      });
      if (funcIdx !== -1) {
        addMapping(funcIdx, f.sourceLine);
        lineIdx = funcIdx + 1;
        mapBodyStatements(f.body, lineIdx, "        ");
      }
    }
  }

  return { sourceFile, mappings };
}
