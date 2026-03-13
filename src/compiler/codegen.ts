import { DEFAULT_CONFIG } from "../config/defaults.ts";
import {
  type Expression,
  type NatSpec,
  type SkittlesConstructor,
  type SkittlesContract,
  type SkittlesContractInterface,
  type SkittlesEvent,
  type SkittlesFunction,
  type SkittlesParameter,
  type SkittlesType,
  SkittlesTypeKind,
  type SkittlesVariable,
  type SolidityConfig,
  type Statement,
  type Visibility,
} from "../types/index.ts";
import { cctx } from "./codegen-context.ts";
import { walkStatements } from "./walker.ts";

// Sub-module imports
import {
  collectLocalVarNames,
  pickNewName,
  renameInExpression,
  renameInStatements,
  scopeAwareRenameBlock,
  resolveShadowedLocals,
} from "./codegen/rename.ts";
import { emitHelperFunctions, hasAncestorOrigin } from "./codegen/helpers.ts";
import {
  generateType,
  generateParamType,
  generateCalldataParamType,
  generateExpression,
} from "./codegen/expressions.ts";
import {
  generateStatement,
  isRequirePattern,
  negateExpression,
} from "./codegen/statements.ts";
import {
  buildSourceMap,
  computeAncestors,
  getFunctionKey,
} from "./codegen/sourcemap.ts";

// Re-exports for public API
export type { CodegenContext } from "./codegen-context.ts";
export { resetCodegenContext } from "./codegen-context.ts";
export { generateType, generateExpression } from "./codegen/expressions.ts";
export { generateStatement } from "./codegen/statements.ts";
export { resolveShadowedLocals } from "./codegen/rename.ts";
export { buildSourceMap } from "./codegen/sourcemap.ts";

// ============================================================
// Main entry
// ============================================================

/**
 * Generate a Solidity file containing multiple contracts.
 * Used when a single source file defines multiple classes (e.g., for inheritance).
 */
export function generateSolidityFile(
  contracts: SkittlesContract[],
  imports?: string[],
  solidityConfig?: SolidityConfig
): string {
  const license = solidityConfig?.license ?? DEFAULT_CONFIG.solidity.license;
  const version = solidityConfig?.version ?? DEFAULT_CONFIG.solidity.version;
  const parts: string[] = [];
  parts.push(`// SPDX-License-Identifier: ${license}`);
  parts.push(`pragma solidity ${version};`);
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

  cctx.allKnownEnumNames = new Set<string>();
  cctx.allKnownInterfaceNames = new Set<string>();
  for (const c of contracts) {
    for (const en of c.enums ?? []) cctx.allKnownEnumNames.add(en.name);
    for (const iface of c.contractInterfaces ?? [])
      cctx.allKnownInterfaceNames.add(iface.name);
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
          parts.push(generateStructDecl(s, ""));
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
    ancestorsMap.set(contract.name, computeAncestors(contract, contractByName));
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
        ancestors,
        contractByName
      )
    );
    if (i < contracts.length - 1) {
      parts.push("");
    }
  }

  parts.push("");
  return parts.join("\n");
}

export function generateSolidity(
  contract: SkittlesContract,
  imports?: string[],
  solidityConfig?: SolidityConfig
): string {
  return generateSolidityFile([contract], imports, solidityConfig);
}

// ============================================================
// Contract body generation
// ============================================================

function emitNatSpecTag(
  lines: string[],
  indent: string,
  tag: string,
  text: string
): void {
  const textLines = text.split("\n");
  lines.push(`${indent}/// @${tag} ${textLines[0]}`);
  for (let i = 1; i < textLines.length; i++) {
    const trimmed = textLines[i].trim();
    if (trimmed) {
      lines.push(`${indent}/// ${trimmed}`);
    } else {
      lines.push(`${indent}///`);
    }
  }
}

function generateNatSpecLines(
  natspec: NatSpec | undefined,
  indent: string = ""
): string[] {
  if (!natspec) return [];
  const lines: string[] = [];
  if (natspec.title) emitNatSpecTag(lines, indent, "title", natspec.title);
  if (natspec.author) emitNatSpecTag(lines, indent, "author", natspec.author);
  if (natspec.notice) emitNatSpecTag(lines, indent, "notice", natspec.notice);
  if (natspec.dev) emitNatSpecTag(lines, indent, "dev", natspec.dev);
  if (natspec.params) {
    for (const p of natspec.params) {
      emitNatSpecTag(lines, indent, `param ${p.name}`, p.description);
    }
  }
  if (natspec.returns) emitNatSpecTag(lines, indent, "return", natspec.returns);
  return lines;
}

function generateContractBody(
  contract: SkittlesContract,
  fileScopeTypes: Set<string> = new Set(),
  definitionOrigins: Map<string, Set<string>> = new Map(),
  functionOrigins: Map<string, Set<string>> = new Map(),
  ancestors: Set<string> = new Set(),
  contractByName: Map<string, SkittlesContract> = new Map()
): string {
  const parts: string[] = [];
  cctx.helpers = new Set();
  cctx.currentNeededArrayHelpers = contract.neededArrayHelpers ?? [];

  // Track state variables whose type is an enum (for enum→uint256 return casts)
  cctx.currentEnumStateVarNames = new Set(
    contract.variables
      .filter((v) => v.type.kind === SkittlesTypeKind.Enum)
      .map((v) => v.name)
  );

  const inheritance =
    contract.inherits.length > 0 ? ` is ${contract.inherits.join(", ")}` : "";
  const abstractPrefix = contract.isAbstract ? "abstract " : "";
  const contractNatSpec = generateNatSpecLines(contract.natspec);
  for (const line of contractNatSpec) parts.push(line);
  parts.push(`${abstractPrefix}contract ${contract.name}${inheritance} {`);

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
    if (hasAncestorOrigin(definitionOrigins.get(en.name), ancestors)) continue;
    addOrigin(definitionOrigins, en.name);
    parts.push(`    enum ${en.name} { ${en.members.join(", ")} }`);
    parts.push("");
  }

  let emittedCustomErrorCount = 0;
  for (const ce of contract.customErrors ?? []) {
    if (hasAncestorOrigin(definitionOrigins.get(ce.name), ancestors)) continue;
    addOrigin(definitionOrigins, ce.name);
    const errorNatSpec = generateNatSpecLines(ce.natspec, "    ");
    for (const line of errorNatSpec) parts.push(line);
    const params = ce.parameters
      .map((p) => `${generateType(p.type)} ${p.name}`)
      .join(", ");
    parts.push(`    error ${ce.name}(${params});`);
    emittedCustomErrorCount++;
  }
  if (emittedCustomErrorCount > 0) {
    parts.push("");
  }

  for (const s of contract.structs ?? []) {
    if (fileScopeTypes.has(s.name)) continue;
    if (hasAncestorOrigin(definitionOrigins.get(s.name), ancestors)) continue;
    addOrigin(definitionOrigins, s.name);
    parts.push(generateStructDecl(s));
    parts.push("");
  }

  for (const e of contract.events) {
    const eventNatSpec = generateNatSpecLines(e.natspec, "    ");
    for (const line of eventNatSpec) parts.push(line);
    parts.push(`    ${generateEventDecl(e)}`);
  }

  if (contract.events.length > 0) {
    parts.push("");
  }

  const { stateVarNames, readonlyArrayVars, functionsToEmit } =
    generateStateVariables(parts, contract, ancestors, contractByName, functionOrigins, addOrigin);

  generateContractFunctions(
    parts, contract, stateVarNames, readonlyArrayVars, functionsToEmit,
    ancestors, contractByName
  );

  emitHelperFunctions(parts, addOrigin, functionOrigins, ancestors);

  parts.push("}");

  return parts.join("\n");
}

function generateStateVariables(
  parts: string[],
  contract: SkittlesContract,
  ancestors: Set<string>,
  contractByName: Map<string, SkittlesContract>,
  functionOrigins: Map<string, Set<string>>,
  addOrigin: (map: Map<string, Set<string>>, key: string) => void
): {
  stateVarNames: Set<string>;
  readonlyArrayVars: SkittlesVariable[];
  functionsToEmit: SkittlesFunction[];
} {
  for (const v of contract.variables) {
    const varNatSpec = generateNatSpecLines(v.natspec, "    ");
    for (const line of varNatSpec) parts.push(line);
    parts.push(`    ${generateVariable(v)}`);
  }

  const readonlyArrayVars = contract.variables.filter(
    (v) => v.immutable && v.type.kind === SkittlesTypeKind.Array
  );

  // Collect state variable names for shadowing detection, including inherited
  // ones from ancestor contracts.
  const stateVarNames = new Set(contract.variables.map((v) => v.name));
  for (const ancestorName of ancestors) {
    const ancestor = contractByName.get(ancestorName);
    if (ancestor) {
      for (const v of ancestor.variables) {
        stateVarNames.add(v.name);
      }
    }
  }

  // Skip functions already emitted by an ancestor contract in the same file
  // (shared file-level functions injected into both parent and child), unless
  // the child explicitly overrides them.  Use a full signature key (name +
  // full parameter types) so overloads are not incorrectly suppressed.
  const functionsToEmit = contract.functions.filter((f) => {
    const key = getFunctionKey(f);
    return !hasAncestorOrigin(functionOrigins.get(key), ancestors) || f.isOverride;
  });
  for (const f of functionsToEmit) {
    addOrigin(functionOrigins, getFunctionKey(f));
  }

  if (
    contract.variables.length > 0 &&
    (contract.ctor ||
      functionsToEmit.length > 0 ||
      readonlyArrayVars.length > 0)
  ) {
    parts.push("");
  }

  return { stateVarNames, readonlyArrayVars, functionsToEmit };
}

function generateContractFunctions(
  parts: string[],
  contract: SkittlesContract,
  stateVarNames: Set<string>,
  readonlyArrayVars: SkittlesVariable[],
  functionsToEmit: SkittlesFunction[],
  ancestors: Set<string>,
  contractByName: Map<string, SkittlesContract>
): void {
  if (contract.ctor) {
    // Rename default constructor parameters that shadow state variables.
    // Default params become local variable declarations in generateConstructor,
    // so they can trigger shadowing warnings just like body locals.
    const defaultParams = contract.ctor.parameters.filter(
      (p) => p.defaultValue
    );
    const defaultParamRenames = new Map<string, string>();
    if (defaultParams.length > 0) {
      const bodyLocals = collectLocalVarNames(contract.ctor.body);
      const taken = new Set([
        ...stateVarNames,
        ...contract.ctor.parameters.map((p) => p.name),
        ...bodyLocals,
      ]);
      for (const p of defaultParams) {
        if (stateVarNames.has(p.name)) {
          const newName = pickNewName(p.name, taken);
          defaultParamRenames.set(p.name, newName);
          taken.add(newName);
        }
      }
    }

    let ctorToResolve = contract.ctor;
    if (defaultParamRenames.size > 0) {
      ctorToResolve = {
        ...contract.ctor,
        parameters: contract.ctor.parameters.map((p) => {
          const renamedName = defaultParamRenames.get(p.name);
          const renamedDefault = p.defaultValue
            ? renameInExpression(p.defaultValue, defaultParamRenames)
            : undefined;
          return {
            ...p,
            ...(renamedName ? { name: renamedName } : {}),
            ...(renamedDefault ? { defaultValue: renamedDefault } : {}),
          };
        }),
        body: scopeAwareRenameBlock(
          contract.ctor.body,
          new Map(defaultParamRenames),
          new Map()
        ),
      };
    }

    const ctorParamNames = new Set(ctorToResolve.parameters.map((p) => p.name));
    const ctorResolved = {
      ...ctorToResolve,
      body: resolveShadowedLocals(
        ctorToResolve.body,
        stateVarNames,
        ctorParamNames
      ),
    };
    parts.push(generateConstructor(ctorResolved, contract.inherits));
    if (functionsToEmit.length > 0 || readonlyArrayVars.length > 0) {
      parts.push("");
    }
  }

  // Collect all function names in this contract so we can detect when a
  // parameter name shadows a sibling function (e.g. setter param "value"
  // shadowing a getter function "value()").
  const allFunctionNames = new Set(functionsToEmit.map((f) => f.name));
  for (const ancestorName of ancestors) {
    const ancestor = contractByName.get(ancestorName);
    if (ancestor) {
      for (const fn of ancestor.functions) allFunctionNames.add(fn.name);
    }
  }

  // Expand functions with default parameter values into overloads.
  // Each function with trailing defaults becomes the main implementation
  // plus forwarding overloads for each valid shorter parameter list.
  const expandedFunctions: SkittlesFunction[] = [];
  for (const f of functionsToEmit) {
    expandedFunctions.push(...expandDefaultParamOverloads(f));
  }

  for (let i = 0; i < expandedFunctions.length; i++) {
    let f = expandedFunctions[i];

    // Rename parameters that shadow sibling function names.
    const paramRenames = new Map<string, string>();
    const taken = new Set([
      ...stateVarNames,
      ...allFunctionNames,
      ...f.parameters.map((p) => p.name),
      ...collectLocalVarNames(f.body),
    ]);
    for (const p of f.parameters) {
      if (allFunctionNames.has(p.name) && p.name !== f.name) {
        const newName = pickNewName(p.name, taken);
        paramRenames.set(p.name, newName);
        taken.add(newName);
      }
    }
    if (paramRenames.size > 0) {
      f = {
        ...f,
        parameters: f.parameters.map((p) => {
          const renamedName = paramRenames.get(p.name);
          return renamedName ? { ...p, name: renamedName } : p;
        }),
        body: renameInStatements(f.body, paramRenames),
      };
    }

    const funcParamNames = new Set(f.parameters.map((p) => p.name));
    const resolved = {
      ...f,
      body: resolveShadowedLocals(f.body, stateVarNames, funcParamNames),
    };
    parts.push(generateFunction(resolved));
    if (i < expandedFunctions.length - 1 || readonlyArrayVars.length > 0) {
      parts.push("");
    }
  }

  for (let i = 0; i < readonlyArrayVars.length; i++) {
    parts.push(generateReadonlyArrayGetter(readonlyArrayVars[i]));
    if (i < readonlyArrayVars.length - 1) {
      parts.push("");
    }
  }
}

// ============================================================
// Contract elements
// ============================================================

function generateStructDecl(
  s: {
    name: string;
    fields: SkittlesParameter[];
  },
  indent: string = "    "
): string {
  const lines: string[] = [];
  lines.push(`${indent}struct ${s.name} {`);
  for (const f of s.fields) {
    lines.push(`${indent}    ${generateType(f.type)} ${f.name};`);
  }
  lines.push(`${indent}}`);
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
    const mut =
      f.stateMutability && f.stateMutability !== "nonpayable"
        ? ` ${f.stateMutability}`
        : "";
    let returns = "";
    if (f.returnType && f.returnType.kind !== SkittlesTypeKind.Void) {
      if (f.returnType.kind === SkittlesTypeKind.Tuple) {
        const tupleParams = (f.returnType.tupleTypes ?? [])
          .map(generateParamType)
          .join(", ");
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
  lines.push(
    `    function ${getterName}() public view returns (${type} memory) {`
  );
  lines.push(`        return ${name};`);
  lines.push("    }");
  return lines.join("\n");
}

/**
 * Check whether an expression tree may perform state-modifying operations.
 * Used to decide whether a default-parameter forwarding overload needs to
 * widen its mutability beyond `view`.  Function calls, assignments, and
 * `new` expressions are conservatively treated as potentially state-modifying
 * because we cannot determine callee mutability at codegen time.
 */
function expressionMayModifyState(expr: Expression): boolean {
  switch (expr.kind) {
    case "call":
    case "new":
    case "assignment":
      return true;
    case "binary":
      return (
        expressionMayModifyState(expr.left) ||
        expressionMayModifyState(expr.right)
      );
    case "unary":
      // ++ / -- are always state-modifying (they mutate the operand).
      if (expr.operator === "++" || expr.operator === "--") {
        return true;
      }
      return expressionMayModifyState(expr.operand);
    case "conditional":
      return (
        expressionMayModifyState(expr.condition) ||
        expressionMayModifyState(expr.whenTrue) ||
        expressionMayModifyState(expr.whenFalse)
      );
    case "property-access":
      return expressionMayModifyState(expr.object);
    case "element-access":
      return (
        expressionMayModifyState(expr.object) ||
        expressionMayModifyState(expr.index)
      );
    case "tuple-literal":
      return expr.elements.some(expressionMayModifyState);
    case "object-literal":
      return expr.properties.some((p) => expressionMayModifyState(p.value));
    // Literals and identifiers are always safe (pure reads at most).
    case "number-literal":
    case "string-literal":
    case "boolean-literal":
    case "identifier":
      return false;
    default:
      // Be conservative: treat unknown expression kinds as potentially state-modifying.
      return true;
  }
}

/**
 * Expand a function that has default parameter values into multiple
 * Solidity overloads. The original function keeps all parameters (with
 * defaults stripped) and retains the implementation body. For each
 * trailing group of default parameters, an overload is generated that
 * forwards to the full-parameter version with the default values filled in.
 *
 * Example: f(a, b = 5, c = 10) becomes:
 *   - f(a, b, c) { ... }        // main implementation
 *   - f(a, b) { return f(a, b, 10); }
 *   - f(a) { return f(a, 5, 10); }
 */
export function expandDefaultParamOverloads(f: SkittlesFunction): SkittlesFunction[] {
  const defaultParams = f.parameters.filter((p) => p.defaultValue);
  if (defaultParams.length === 0) return [f];

  // Find the index of the first default parameter
  const firstDefaultIdx = f.parameters.findIndex((p) => p.defaultValue);

  // Validate that all parameters from the first default onward also have
  // defaults (i.e. defaults must be contiguous and trailing).
  for (let i = firstDefaultIdx; i < f.parameters.length; i++) {
    if (!f.parameters[i].defaultValue) {
      throw new Error(
        `Function "${f.name}" has a non-default parameter after a default parameter; ` +
          "default-valued parameters must be contiguous and trailing."
      );
    }
  }

  // Main function: strip defaultValue from all parameters
  const mainFn: SkittlesFunction = {
    ...f,
    parameters: f.parameters.map((p) => {
      const { defaultValue, ...rest } = p;
      return rest;
    }),
  };

  const result: SkittlesFunction[] = [mainFn];

  // Validate that no parameter (or default-generated local) shadows the
  // function name, which would cause the forwarding call to resolve to
  // the variable instead of the function (Solidity compile-time error).
  for (const p of f.parameters) {
    if (p.name === f.name) {
      throw new Error(
        `Function "${f.name}" has a parameter named "${p.name}" that shadows the function name; ` +
          "rename the parameter to avoid breaking the generated forwarding overload."
      );
    }
  }

  // Generate overloads for each valid parameter count
  // from (all params - 1 default) down to (only required params)
  for (
    let paramCount = f.parameters.length - 1;
    paramCount >= firstDefaultIdx;
    paramCount--
  ) {
    const shortParams = f.parameters.slice(0, paramCount).map((p) => {
      const { defaultValue, ...rest } = p;
      return rest;
    });

    // Build forwarding body. Omitted default parameters are declared as
    // local variables so that later defaults can reference earlier ones
    // (e.g. f(a = 1, b = a) → the overload for f() declares `a`, then `b = a`).
    const body: Statement[] = [];
    for (let i = paramCount; i < f.parameters.length; i++) {
      body.push({
        kind: "variable-declaration",
        name: f.parameters[i].name,
        type: f.parameters[i].type,
        initializer: f.parameters[i].defaultValue!,
      });
    }

    // Build forwarding call using both the overload's own parameters
    // and the locally-declared default variables.
    const args: Expression[] = f.parameters.map((p) => ({
      kind: "identifier" as const,
      name: p.name,
    }));

    const callExpr: Expression = {
      kind: "call",
      callee: { kind: "identifier", name: f.name },
      args,
    };

    if (f.returnType && f.returnType.kind !== SkittlesTypeKind.Void) {
      body.push({ kind: "return", value: callExpr });
    } else {
      body.push({ kind: "expression", expression: callExpr });
    }

    // Determine the minimum mutability for the overload wrapper.
    // Default value expressions are evaluated in the overload body:
    // - If any default may modify state (contains calls, assignments, or
    //   `new`), widen to nonpayable since we can't verify callee mutability.
    // - Otherwise, widen pure → view conservatively (defaults may read
    //   state/environment, e.g. block.timestamp, this.x).
    // - view and nonpayable stay as-is when defaults are simple expressions.
    const omittedDefaults = f.parameters
      .slice(paramCount)
      .map((p) => p.defaultValue!);
    const defaultsMayModify = omittedDefaults.some(expressionMayModifyState);

    let overloadMutability = f.stateMutability;
    if (defaultsMayModify) {
      if (overloadMutability === "pure" || overloadMutability === "view") {
        if (f.isOverride) {
          // For override wrappers, we cannot safely widen mutability without
          // risking a mismatch with the base signature (e.g. base view,
          // derived nonpayable). Fail fast with a clear error.
          throw new Error(
            `Cannot use state-modifying default parameter expression on overriding ` +
              `${overloadMutability} function "${f.name}". Either remove the state-modifying ` +
              `default, change the base function's mutability, or avoid using overrides with ` +
              `such defaults.`
          );
        }
        // Conservatively widen to nonpayable when defaults contain
        // potentially state-modifying operations (calls, assignments, new).
        overloadMutability = "nonpayable";
      }
    } else if (overloadMutability === "pure") {
      // Simple defaults (literals, identifiers) may still read state,
      // so widen pure → view as a safe minimum.
      overloadMutability = "view";
    }

    const overload: SkittlesFunction = {
      ...f,
      parameters: shortParams,
      body,
      stateMutability: overloadMutability,
      // Inherit override/virtual from the original function so that
      // overloads correctly participate in inheritance when both base
      // and derived contracts define defaults on the same method.
      isOverride: f.isOverride,
      isVirtual: f.isVirtual,
      // Overload wrappers must be concrete even when the main function
      // is abstract — abstract contracts can still have concrete
      // forwarding functions that call an abstract virtual function.
      isAbstract: false,
    };

    result.push(overload);
  }

  return result;
}

function generateFunction(f: SkittlesFunction): string {
  const natspecLines = generateNatSpecLines(f.natspec, "    ");
  const prevReturnType = cctx.currentFunctionReturnType;
  cctx.currentFunctionReturnType = f.returnType;

  if (f.name === "receive") {
    const lines: string[] = [...natspecLines];
    lines.push("    receive() external payable {");
    for (const s of f.body) {
      lines.push(generateStatement(s, "        "));
    }
    lines.push("    }");
    cctx.currentFunctionReturnType = prevReturnType;
    return lines.join("\n");
  }

  if (f.name === "fallback") {
    const lines: string[] = [...natspecLines];
    lines.push("    fallback() external payable {");
    for (const s of f.body) {
      lines.push(generateStatement(s, "        "));
    }
    lines.push("    }");
    cctx.currentFunctionReturnType = prevReturnType;
    return lines.join("\n");
  }

  const params = f.parameters
    .map((p) => `${generateParamType(p.type)} ${p.name}`)
    .join(", ");

  const vis = mapVisibility(f.visibility);
  const mut =
    f.stateMutability === "nonpayable"
      ? ""
      : f.stateMutability === "payable"
        ? " payable"
        : ` ${f.stateMutability}`;

  const virtOverride = f.isOverride
    ? " override"
    : f.isVirtual
      ? " virtual"
      : "";

  let returns = "";
  if (f.returnType && f.returnType.kind !== SkittlesTypeKind.Void) {
    if (f.returnType.kind === SkittlesTypeKind.Tuple) {
      const tupleParams = (f.returnType.tupleTypes ?? [])
        .map(generateParamType)
        .join(", ");
      returns = ` returns (${tupleParams})`;
    } else {
      returns = ` returns (${generateParamType(f.returnType)})`;
    }
  }

  const lines: string[] = [...natspecLines];
  if (f.isAbstract) {
    lines.push(
      `    function ${f.name}(${params}) ${vis}${mut}${virtOverride}${returns};`
    );
  } else {
    lines.push(
      `    function ${f.name}(${params}) ${vis}${mut}${virtOverride}${returns} {`
    );
    for (const s of f.body) {
      lines.push(generateStatement(s, "        "));
    }
    lines.push("    }");
  }
  cctx.currentFunctionReturnType = prevReturnType;
  return lines.join("\n");
}

function isSuperCall(stmt: Statement): boolean {
  return getSuperCallArgs(stmt) !== null;
}

function getSuperCallArgs(stmt: Statement): Expression[] | null {
  if (
    stmt.kind === "expression" &&
    stmt.expression.kind === "call" &&
    stmt.expression.callee.kind === "identifier" &&
    stmt.expression.callee.name === "super"
  ) {
    return stmt.expression.args;
  }
  return null;
}

function generateConstructor(
  c: SkittlesConstructor,
  inherits: string[] = []
): string {
  const regularParams = c.parameters.filter((p) => !p.defaultValue);
  const defaultParams = c.parameters.filter((p) => p.defaultValue);

  const params = regularParams
    .map((p) => `${generateParamType(p.type)} ${p.name}`)
    .join(", ");

  // Extract super() call(s) from the body and validate.
  const superCalls = c.body.filter(isSuperCall);
  if (superCalls.length > 1) {
    throw new Error(
      "Constructor contains multiple super() calls, but only one is allowed"
    );
  }
  const bodyWithoutSuper = c.body.filter((s) => !isSuperCall(s));
  let parentModifier = "";
  if (superCalls.length === 1) {
    const args = getSuperCallArgs(superCalls[0])!;
    if (args.length > 0) {
      if (inherits.length === 0) {
        throw new Error(
          "Constructor contains a super(...) call, but no parent contract is specified in 'inherits'"
        );
      }
      if (defaultParams.length > 0) {
        throw new Error(
          "super(...) with constructor parameters that have default values is not supported"
        );
      }
      parentModifier = ` ${inherits[0]}(${args.map(generateExpression).join(", ")})`;
    }
  }

  const lines: string[] = [];
  lines.push(`    constructor(${params})${parentModifier} {`);
  for (const p of defaultParams) {
    lines.push(
      `        ${generateParamType(p.type)} ${p.name} = ${generateExpression(p.defaultValue!)};`
    );
  }
  for (const s of bodyWithoutSuper) {
    lines.push(generateStatement(s, "        "));
  }
  lines.push("    }");

  return lines.join("\n");
}

// ============================================================
// Console.log detection
// ============================================================

function statementsUseConsoleLog(stmts: Statement[]): boolean {
  let found = false;
  walkStatements(stmts, {
    visitStatement(stmt) {
      if (stmt.kind === "console-log") found = true;
    },
  });
  return found;
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
