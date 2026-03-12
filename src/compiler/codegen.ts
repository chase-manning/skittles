import {
  ADDRESS_LITERAL_RE,
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
  type SolidityConfig,
} from "../types/index.ts";
import { DEFAULT_CONFIG } from "../config/defaults.ts";

// ============================================================
// Helper function tracking
// ============================================================

let _needsMinHelper = false;
let _needsMaxHelper = false;
let _needsSqrtHelper = false;
let _needsCharAtHelper = false;
let _needsSubstringHelper = false;
let _needsToLowerCaseHelper = false;
let _needsToUpperCaseHelper = false;
let _needsStartsWithHelper = false;
let _needsEndsWithHelper = false;
let _needsTrimHelper = false;
let _needsSplitHelper = false;
let _needsToStringHelper = false;
let _needsReplaceHelper = false;
let _needsReplaceAllHelper = false;
let _currentNeededArrayHelpers: string[] = [];
let _allKnownEnumNames = new Set<string>();
let _allKnownInterfaceNames = new Set<string>();

const SOLIDITY_VALUE_TYPES = new Set([
  "uint256", "int256", "address", "bool", "bytes32",
  "uint8", "uint16", "uint32", "uint64", "uint128",
  "int8", "int16", "int32", "int64", "int128",
  "bytes1", "bytes2", "bytes3", "bytes4",
]);

// ============================================================
// Shadowed local variable renaming
// ============================================================

function collectLocalVarNames(stmts: Statement[]): Set<string> {
  const names = new Set<string>();
  for (const s of stmts) {
    switch (s.kind) {
      case "variable-declaration":
        names.add(s.name);
        break;
      case "tuple-destructuring":
        for (const n of s.names) if (n !== null) names.add(n);
        break;
      case "if":
        for (const n of collectLocalVarNames(s.thenBody)) names.add(n);
        if (s.elseBody) for (const n of collectLocalVarNames(s.elseBody)) names.add(n);
        break;
      case "for":
        if (s.initializer?.kind === "variable-declaration") names.add(s.initializer.name);
        for (const n of collectLocalVarNames(s.body)) names.add(n);
        break;
      case "while":
      case "do-while":
        for (const n of collectLocalVarNames(s.body)) names.add(n);
        break;
      case "switch":
        for (const c of s.cases) for (const n of collectLocalVarNames(c.body)) names.add(n);
        break;
      case "try-catch":
        if (s.returnVarName) names.add(s.returnVarName);
        for (const n of collectLocalVarNames(s.successBody)) names.add(n);
        for (const n of collectLocalVarNames(s.catchBody)) names.add(n);
        break;
    }
  }
  return names;
}

function pickNewName(original: string, taken: Set<string>): string {
  let candidate = `_${original}`;
  while (taken.has(candidate)) {
    candidate = `_${candidate}`;
  }
  return candidate;
}

function renameInExpression(expr: Expression, renames: Map<string, string>): Expression {
  switch (expr.kind) {
    case "identifier": {
      const newName = renames.get(expr.name);
      return newName ? { ...expr, name: newName } : expr;
    }
    case "binary":
      return { ...expr, left: renameInExpression(expr.left, renames), right: renameInExpression(expr.right, renames) };
    case "unary":
      return { ...expr, operand: renameInExpression(expr.operand, renames) };
    case "assignment":
      return { ...expr, target: renameInExpression(expr.target, renames), value: renameInExpression(expr.value, renames) };
    case "call":
      return { ...expr, callee: renameInExpression(expr.callee, renames), args: expr.args.map((a) => renameInExpression(a, renames)) };
    case "conditional":
      return { ...expr, condition: renameInExpression(expr.condition, renames), whenTrue: renameInExpression(expr.whenTrue, renames), whenFalse: renameInExpression(expr.whenFalse, renames) };
    case "property-access":
      return { ...expr, object: renameInExpression(expr.object, renames) };
    case "element-access":
      return { ...expr, object: renameInExpression(expr.object, renames), index: renameInExpression(expr.index, renames) };
    case "new":
      return { ...expr, args: expr.args.map((a) => renameInExpression(a, renames)) };
    case "object-literal":
      return { ...expr, properties: expr.properties.map((p) => ({ ...p, value: renameInExpression(p.value, renames) })) };
    case "tuple-literal":
      return { ...expr, elements: expr.elements.map((e) => renameInExpression(e, renames)) };
    default:
      return expr;
  }
}

function renameInStatement(stmt: Statement, renames: Map<string, string>): Statement {
  switch (stmt.kind) {
    case "variable-declaration": {
      const newName = renames.get(stmt.name) ?? stmt.name;
      return { ...stmt, name: newName, initializer: stmt.initializer ? renameInExpression(stmt.initializer, renames) : undefined };
    }
    case "tuple-destructuring": {
      const newNames = stmt.names.map((n) => n === null ? null : (renames.get(n) ?? n));
      return { ...stmt, names: newNames, initializer: renameInExpression(stmt.initializer, renames) };
    }
    case "return":
      return { ...stmt, value: stmt.value ? renameInExpression(stmt.value, renames) : undefined };
    case "expression":
      return { ...stmt, expression: renameInExpression(stmt.expression, renames) };
    case "if":
      return { ...stmt, condition: renameInExpression(stmt.condition, renames), thenBody: renameInStatements(stmt.thenBody, renames), elseBody: stmt.elseBody ? renameInStatements(stmt.elseBody, renames) : undefined };
    case "for": {
      let init = stmt.initializer;
      if (init) {
        init = renameInStatement(init, renames) as typeof init;
      }
      return { ...stmt, initializer: init, condition: stmt.condition ? renameInExpression(stmt.condition, renames) : undefined, incrementor: stmt.incrementor ? renameInExpression(stmt.incrementor, renames) : undefined, body: renameInStatements(stmt.body, renames) };
    }
    case "while":
    case "do-while":
      return { ...stmt, condition: renameInExpression(stmt.condition, renames), body: renameInStatements(stmt.body, renames) };
    case "emit":
      return { ...stmt, args: stmt.args.map((a) => renameInExpression(a, renames)) };
    case "revert":
      return { ...stmt, message: stmt.message ? renameInExpression(stmt.message, renames) : undefined, customErrorArgs: stmt.customErrorArgs?.map((a) => renameInExpression(a, renames)) };
    case "delete":
      return { ...stmt, target: renameInExpression(stmt.target, renames) };
    case "switch":
      return { ...stmt, discriminant: renameInExpression(stmt.discriminant, renames), cases: stmt.cases.map((c) => ({ ...c, value: c.value ? renameInExpression(c.value, renames) : undefined, body: renameInStatements(c.body, renames) })) };
    case "try-catch": {
      const newReturnVarName = stmt.returnVarName ? (renames.get(stmt.returnVarName) ?? stmt.returnVarName) : undefined;
      return { ...stmt, call: renameInExpression(stmt.call, renames), returnVarName: newReturnVarName, successBody: renameInStatements(stmt.successBody, renames), catchBody: renameInStatements(stmt.catchBody, renames) };
    }
    case "console-log":
      return { ...stmt, args: stmt.args.map((a) => renameInExpression(a, renames)) };
    default:
      return stmt;
  }
}

function renameInStatements(stmts: Statement[], renames: Map<string, string>): Statement[] {
  return stmts.map((s) => renameInStatement(s, renames));
}

// Scope-aware renaming: renames are activated only when their declaration is
// encountered, and inner-block declarations do not leak to outer scopes.

function scopeAwareRenameBlock(
  stmts: Statement[],
  parentActive: Map<string, string>,
  allRenames: Map<string, string>
): Statement[] {
  let active = new Map(parentActive);
  const result: Statement[] = [];
  for (const stmt of stmts) {
    const out = scopeAwareRenameStmt(stmt, active, allRenames);
    result.push(out.stmt);
    active = out.active;
  }
  return result;
}

function scopeAwareRenameStmt(
  stmt: Statement,
  active: Map<string, string>,
  allRenames: Map<string, string>
): { stmt: Statement; active: Map<string, string> } {
  switch (stmt.kind) {
    case "variable-declaration": {
      const rename = allRenames.get(stmt.name);
      if (rename) {
        // Rename the initializer with the parent scope (before declaration is active)
        const init = stmt.initializer
          ? renameInExpression(stmt.initializer, active)
          : undefined;
        const newActive = new Map(active);
        newActive.set(stmt.name, rename);
        return {
          stmt: { ...stmt, name: rename, initializer: init },
          active: newActive,
        };
      }
      const init = stmt.initializer
        ? renameInExpression(stmt.initializer, active)
        : undefined;
      // Suppress pre-activated rename when a body local re-declares the same name
      // (used for ctor default params where renames start active via parentActive)
      if (active.has(stmt.name) && !allRenames.has(stmt.name)) {
        const newActive = new Map(active);
        newActive.delete(stmt.name);
        return { stmt: { ...stmt, initializer: init }, active: newActive };
      }
      return { stmt: { ...stmt, initializer: init }, active };
    }
    case "tuple-destructuring": {
      const renamedInit = renameInExpression(stmt.initializer, active);
      const newActive = new Map(active);
      const newNames = stmt.names.map((name) => {
        if (name === null) return null;
        const rename = allRenames.get(name);
        if (rename) {
          // Apply configured rename and activate it for this scope
          newActive.set(name, rename);
          return rename;
        }
        // Suppress pre-activated rename when a tuple element re-declares the same name
        // without a new rename configured in this scope.
        if (active.has(name) && !allRenames.has(name)) {
          newActive.delete(name);
        }
        return name;
      });
      return {
        stmt: { ...stmt, names: newNames, initializer: renamedInit },
        active: newActive,
      };
    }
    case "if":
      return {
        stmt: {
          ...stmt,
          condition: renameInExpression(stmt.condition, active),
          thenBody: scopeAwareRenameBlock(stmt.thenBody, active, allRenames),
          elseBody: stmt.elseBody
            ? scopeAwareRenameBlock(stmt.elseBody, active, allRenames)
            : undefined,
        },
        active,
      };
    case "for": {
      const forActive = new Map(active);
      let init = stmt.initializer;
      if (init) {
        if (init.kind === "variable-declaration") {
          const rename = allRenames.get(init.name);
          if (rename) {
            // Rename the initializer with the parent scope (before loop var is active)
            const renamedInit = init.initializer
              ? renameInExpression(init.initializer, forActive)
              : undefined;
            forActive.set(init.name, rename);
            init = { ...init, name: rename, initializer: renamedInit };
          } else {
            const initName = init.name;
            init = {
              ...init,
              initializer: init.initializer
                ? renameInExpression(init.initializer, forActive)
                : undefined,
            } as typeof init;
            // Suppress pre-activated rename when for-loop init re-declares the same name
            if (forActive.has(initName) && !allRenames.has(initName)) {
              forActive.delete(initName);
            }
          }
        } else {
          init = renameInStatement(init, forActive) as typeof init;
        }
      }
      return {
        stmt: {
          ...stmt,
          initializer: init,
          condition: stmt.condition
            ? renameInExpression(stmt.condition, forActive)
            : undefined,
          incrementor: stmt.incrementor
            ? renameInExpression(stmt.incrementor, forActive)
            : undefined,
          body: scopeAwareRenameBlock(stmt.body, forActive, allRenames),
        },
        active,
      };
    }
    case "while":
      return {
        stmt: {
          ...stmt,
          condition: renameInExpression(stmt.condition, active),
          body: scopeAwareRenameBlock(stmt.body, active, allRenames),
        },
        active,
      };
    case "do-while":
      return {
        stmt: {
          ...stmt,
          body: scopeAwareRenameBlock(stmt.body, active, allRenames),
          condition: renameInExpression(stmt.condition, active),
        },
        active,
      };
    case "switch":
      return {
        stmt: {
          ...stmt,
          discriminant: renameInExpression(stmt.discriminant, active),
          cases: stmt.cases.map((c) => ({
            ...c,
            value: c.value ? renameInExpression(c.value, active) : undefined,
            body: scopeAwareRenameBlock(c.body, active, allRenames),
          })),
        },
        active,
      };
    case "try-catch": {
      const tryActive = new Map(active);
      let newReturnVarName = stmt.returnVarName;
      if (stmt.returnVarName && allRenames.has(stmt.returnVarName)) {
        const rename = allRenames.get(stmt.returnVarName)!;
        tryActive.set(stmt.returnVarName, rename);
        newReturnVarName = rename;
      } else if (stmt.returnVarName && tryActive.has(stmt.returnVarName) && !allRenames.has(stmt.returnVarName)) {
        // Suppress pre-activated rename when try-catch return var re-declares the same name
        tryActive.delete(stmt.returnVarName);
      }
      return {
        stmt: {
          ...stmt,
          call: renameInExpression(stmt.call, active),
          returnVarName: newReturnVarName,
          successBody: scopeAwareRenameBlock(stmt.successBody, tryActive, allRenames),
          catchBody: scopeAwareRenameBlock(stmt.catchBody, active, allRenames),
        },
        active,
      };
    }
    default:
      return { stmt: renameInStatement(stmt, active), active };
  }
}

export function resolveShadowedLocals(body: Statement[], stateVarNames: Set<string>, paramNames?: Set<string>): Statement[] {
  const localNames = collectLocalVarNames(body);
  const shadowed = new Set<string>();
  for (const name of localNames) {
    if (stateVarNames.has(name)) {
      shadowed.add(name);
    }
  }
  if (shadowed.size === 0) return body;

  const taken = new Set([...stateVarNames, ...localNames, ...(paramNames ?? [])]);
  const renames = new Map<string, string>();
  for (const name of shadowed) {
    const newName = pickNewName(name, taken);
    renames.set(name, newName);
    taken.add(newName);
  }
  return scopeAwareRenameBlock(body, new Map(), renames);
}

function suffixToSolType(suffix: string): string {
  if (suffix.startsWith("arr_")) return `${suffixToSolType(suffix.slice(4))}[]`;
  return suffix;
}

// ============================================================
// Main entry
// ============================================================

/**
 * Generate a Solidity file containing multiple contracts.
 * Used when a single source file defines multiple classes (e.g., for inheritance).
 */
export function generateSolidityFile(contracts: SkittlesContract[], imports?: string[], solidityConfig?: SolidityConfig): string {
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

  _allKnownEnumNames = new Set<string>();
  _allKnownInterfaceNames = new Set<string>();
  for (const c of contracts) {
    for (const en of c.enums ?? []) _allKnownEnumNames.add(en.name);
    for (const iface of c.contractInterfaces ?? []) _allKnownInterfaceNames.add(iface.name);
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

export function generateSolidity(contract: SkittlesContract, imports?: string[], solidityConfig?: SolidityConfig): string {
  return generateSolidityFile([contract], imports, solidityConfig);
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
  _needsMinHelper = false;
  _needsMaxHelper = false;
  _needsSqrtHelper = false;
  _needsCharAtHelper = false;
  _needsSubstringHelper = false;
  _needsToLowerCaseHelper = false;
  _needsToUpperCaseHelper = false;
  _needsStartsWithHelper = false;
  _needsEndsWithHelper = false;
  _needsTrimHelper = false;
  _needsSplitHelper = false;
  _needsToStringHelper = false;
  _needsReplaceHelper = false;
  _needsReplaceAllHelper = false;
  _currentNeededArrayHelpers = contract.neededArrayHelpers ?? [];

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
    // Rename default constructor parameters that shadow state variables.
    // Default params become local variable declarations in generateConstructor,
    // so they can trigger shadowing warnings just like body locals.
    const defaultParams = contract.ctor.parameters.filter((p) => p.defaultValue);
    const defaultParamRenames = new Map<string, string>();
    if (defaultParams.length > 0) {
      const bodyLocals = collectLocalVarNames(contract.ctor.body);
      const taken = new Set([...stateVarNames, ...contract.ctor.parameters.map((p) => p.name), ...bodyLocals]);
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
        body: scopeAwareRenameBlock(contract.ctor.body, new Map(defaultParamRenames), new Map()),
      };
    }

    const ctorParamNames = new Set(ctorToResolve.parameters.map((p) => p.name));
    const ctorResolved = { ...ctorToResolve, body: resolveShadowedLocals(ctorToResolve.body, stateVarNames, ctorParamNames) };
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
    const taken = new Set([...stateVarNames, ...allFunctionNames, ...f.parameters.map((p) => p.name), ...collectLocalVarNames(f.body)]);
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
    const resolved = { ...f, body: resolveShadowedLocals(f.body, stateVarNames, funcParamNames) };
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

  // Emit helper functions, skipping any already emitted by an ancestor contract
  const needsHelper = (name: string, flag: boolean): boolean =>
    flag && !hasAncestorOrigin(functionOrigins.get(name));

  const emitHelper = (name: string, lines: string[]): void => {
    addOrigin(functionOrigins, name);
    parts.push("");
    for (const line of lines) parts.push(line);
  };

  if (needsHelper("_min", _needsMinHelper)) {
    emitHelper("_min", [
      "    function _min(uint256 a, uint256 b) internal pure returns (uint256) {",
      "        return a < b ? a : b;",
      "    }",
    ]);
  }

  if (needsHelper("_max", _needsMaxHelper)) {
    emitHelper("_max", [
      "    function _max(uint256 a, uint256 b) internal pure returns (uint256) {",
      "        return a > b ? a : b;",
      "    }",
    ]);
  }

  if (needsHelper("_sqrt", _needsSqrtHelper)) {
    emitHelper("_sqrt", [
      "    function _sqrt(uint256 x) internal pure returns (uint256) {",
      "        if (x == 0) return 0;",
      "        uint256 z = (x >> 1) + 1;",
      "        uint256 y = x;",
      "        while (z < y) {",
      "            y = z;",
      "            z = (x / z + z) / 2;",
      "        }",
      "        return y;",
      "    }",
    ]);
  }

  if (needsHelper("_charAt", _needsCharAtHelper)) {
    emitHelper("_charAt", [
      "    function _charAt(string memory str, uint256 index) internal pure returns (string memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        require(index < strBytes.length);",
      "        bytes memory result = new bytes(1);",
      "        result[0] = strBytes[index];",
      "        return string(result);",
      "    }",
    ]);
  }

  if (needsHelper("_substring", _needsSubstringHelper)) {
    emitHelper("_substring", [
      "    function _substring(string memory str, uint256 start, uint256 end) internal pure returns (string memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        require(start <= end && end <= strBytes.length);",
      "        bytes memory result = new bytes(end - start);",
      "        for (uint256 i = start; i < end; i++) {",
      "            result[i - start] = strBytes[i];",
      "        }",
      "        return string(result);",
      "    }",
    ]);
  }

  if (needsHelper("_toLowerCase", _needsToLowerCaseHelper)) {
    emitHelper("_toLowerCase", [
      "    function _toLowerCase(string memory str) internal pure returns (string memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        bytes memory result = new bytes(strBytes.length);",
      "        for (uint256 i = 0; i < strBytes.length; i++) {",
      "            uint8 c = uint8(strBytes[i]);",
      "            if (c >= 65 && c <= 90) {",
      "                result[i] = bytes1(c + 32);",
      "            } else {",
      "                result[i] = strBytes[i];",
      "            }",
      "        }",
      "        return string(result);",
      "    }",
    ]);
  }

  if (needsHelper("_toUpperCase", _needsToUpperCaseHelper)) {
    emitHelper("_toUpperCase", [
      "    function _toUpperCase(string memory str) internal pure returns (string memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        bytes memory result = new bytes(strBytes.length);",
      "        for (uint256 i = 0; i < strBytes.length; i++) {",
      "            uint8 c = uint8(strBytes[i]);",
      "            if (c >= 97 && c <= 122) {",
      "                result[i] = bytes1(c - 32);",
      "            } else {",
      "                result[i] = strBytes[i];",
      "            }",
      "        }",
      "        return string(result);",
      "    }",
    ]);
  }

  if (needsHelper("_startsWith", _needsStartsWithHelper)) {
    emitHelper("_startsWith", [
      "    function _startsWith(string memory str, string memory prefix) internal pure returns (bool) {",
      "        bytes memory strBytes = bytes(str);",
      "        bytes memory prefixBytes = bytes(prefix);",
      "        if (prefixBytes.length > strBytes.length) return false;",
      "        for (uint256 i = 0; i < prefixBytes.length; i++) {",
      "            if (strBytes[i] != prefixBytes[i]) return false;",
      "        }",
      "        return true;",
      "    }",
    ]);
  }

  if (needsHelper("_endsWith", _needsEndsWithHelper)) {
    emitHelper("_endsWith", [
      "    function _endsWith(string memory str, string memory suffix) internal pure returns (bool) {",
      "        bytes memory strBytes = bytes(str);",
      "        bytes memory suffixBytes = bytes(suffix);",
      "        if (suffixBytes.length > strBytes.length) return false;",
      "        uint256 offset = strBytes.length - suffixBytes.length;",
      "        for (uint256 i = 0; i < suffixBytes.length; i++) {",
      "            if (strBytes[offset + i] != suffixBytes[i]) return false;",
      "        }",
      "        return true;",
      "    }",
    ]);
  }

  if (needsHelper("_trim", _needsTrimHelper)) {
    emitHelper("_trim", [
      "    function _trim(string memory str) internal pure returns (string memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        uint256 start = 0;",
      "        uint256 end = strBytes.length;",
      "        while (start < end && uint8(strBytes[start]) == 32) { start++; }",
      "        while (end > start && uint8(strBytes[end - 1]) == 32) { end--; }",
      "        bytes memory result = new bytes(end - start);",
      "        for (uint256 i = start; i < end; i++) {",
      "            result[i - start] = strBytes[i];",
      "        }",
      "        return string(result);",
      "    }",
    ]);
  }

  if (needsHelper("_split", _needsSplitHelper)) {
    emitHelper("_split", [
      "    function _split(string memory str, string memory delimiter) internal pure returns (string[] memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        bytes memory delimBytes = bytes(delimiter);",
      "        require(delimBytes.length > 0);",
      "        uint256 count = 1;",
      "        for (uint256 i = 0; i + delimBytes.length <= strBytes.length; i++) {",
      "            bool found = true;",
      "            for (uint256 j = 0; j < delimBytes.length; j++) {",
      "                if (strBytes[i + j] != delimBytes[j]) { found = false; break; }",
      "            }",
      "            if (found) { count++; i += delimBytes.length - 1; }",
      "        }",
      "        string[] memory parts = new string[](count);",
      "        uint256 partIndex = 0;",
      "        uint256 start = 0;",
      "        for (uint256 i = 0; i + delimBytes.length <= strBytes.length; i++) {",
      "            bool found = true;",
      "            for (uint256 j = 0; j < delimBytes.length; j++) {",
      "                if (strBytes[i + j] != delimBytes[j]) { found = false; break; }",
      "            }",
      "            if (found) {",
      "                bytes memory part = new bytes(i - start);",
      "                for (uint256 k = start; k < i; k++) { part[k - start] = strBytes[k]; }",
      "                parts[partIndex++] = string(part);",
      "                start = i + delimBytes.length;",
      "                i += delimBytes.length - 1;",
      "            }",
      "        }",
      "        bytes memory lastPart = new bytes(strBytes.length - start);",
      "        for (uint256 k = start; k < strBytes.length; k++) { lastPart[k - start] = strBytes[k]; }",
      "        parts[partIndex] = string(lastPart);",
      "        return parts;",
      "    }",
    ]);
  }

  if (needsHelper("__sk_toString", _needsToStringHelper)) {
    emitHelper("__sk_toString", [
      "    function __sk_toString(uint256 value) internal pure returns (string memory) {",
      "        if (value == 0) return \"0\";",
      "        uint256 temp = value;",
      "        uint256 digits;",
      "        while (temp != 0) { digits++; temp /= 10; }",
      "        bytes memory buffer = new bytes(digits);",
      "        while (value != 0) {",
      "            digits--;",
      "            buffer[digits] = bytes1(uint8(48 + (value % 10)));",
      "            value /= 10;",
      "        }",
      "        return string(buffer);",
      "    }",
    ]);
  }

  if (needsHelper("_replace", _needsReplaceHelper)) {
    emitHelper("_replace", [
      "    function _replace(string memory str, string memory search, string memory replacement) internal pure returns (string memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        bytes memory searchBytes = bytes(search);",
      "        bytes memory replBytes = bytes(replacement);",
      "        require(searchBytes.length > 0);",
      "        for (uint256 i = 0; i + searchBytes.length <= strBytes.length; i++) {",
      "            bool found = true;",
      "            for (uint256 j = 0; j < searchBytes.length; j++) {",
      "                if (strBytes[i + j] != searchBytes[j]) { found = false; break; }",
      "            }",
      "            if (found) {",
      "                bytes memory result = new bytes(strBytes.length - searchBytes.length + replBytes.length);",
      "                for (uint256 k = 0; k < i; k++) { result[k] = strBytes[k]; }",
      "                for (uint256 k = 0; k < replBytes.length; k++) { result[i + k] = replBytes[k]; }",
      "                for (uint256 k = i + searchBytes.length; k < strBytes.length; k++) { result[k - searchBytes.length + replBytes.length] = strBytes[k]; }",
      "                return string(result);",
      "            }",
      "        }",
      "        return str;",
      "    }",
    ]);
  }

  if (needsHelper("_replaceAll", _needsReplaceAllHelper)) {
    emitHelper("_replaceAll", [
      "    function _replaceAll(string memory str, string memory search, string memory replacement) internal pure returns (string memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        bytes memory searchBytes = bytes(search);",
      "        bytes memory replBytes = bytes(replacement);",
      "        require(searchBytes.length > 0);",
      "        uint256 count = 0;",
      "        for (uint256 i = 0; i + searchBytes.length <= strBytes.length; i++) {",
      "            bool found = true;",
      "            for (uint256 j = 0; j < searchBytes.length; j++) {",
      "                if (strBytes[i + j] != searchBytes[j]) { found = false; break; }",
      "            }",
      "            if (found) { count++; i += searchBytes.length - 1; }",
      "        }",
      "        if (count == 0) return str;",
      "        bytes memory result = new bytes(strBytes.length - (count * searchBytes.length) + (count * replBytes.length));",
      "        uint256 idx = 0;",
      "        for (uint256 i = 0; i < strBytes.length; ) {",
      "            bool found = false;",
      "            if (i + searchBytes.length <= strBytes.length) {",
      "                found = true;",
      "                for (uint256 j = 0; j < searchBytes.length; j++) {",
      "                    if (strBytes[i + j] != searchBytes[j]) { found = false; break; }",
      "                }",
      "            }",
      "            if (found) {",
      "                for (uint256 k = 0; k < replBytes.length; k++) { result[idx++] = replBytes[k]; }",
      "                i += searchBytes.length;",
      "            } else {",
      "                result[idx++] = strBytes[i];",
      "                i++;",
      "            }",
      "        }",
      "        return string(result);",
      "    }",
    ]);
  }

  // Emit array helper functions based on what methods are used,
  // skipping any already emitted by an ancestor contract in this file
  for (const helperKey of _currentNeededArrayHelpers) {
    const [method, ...typeParts] = helperKey.split("_");
    const suffix = typeParts.join("_");
    const solType = suffixToSolType(suffix);
    const isRefType = !SOLIDITY_VALUE_TYPES.has(solType) && !_allKnownEnumNames.has(solType) && !_allKnownInterfaceNames.has(solType);
    const useHashEq = solType === "string" || solType === "bytes";
    const memAnnotation = isRefType ? "memory " : "";
    const eqCheck = useHashEq
      ? `keccak256(abi.encodePacked(arr[i])) == keccak256(abi.encodePacked(value))`
      : `arr[i] == value`;

    if (method === "includes" && needsHelper(`_arrIncludes_${suffix}`, true)) {
      emitHelper(`_arrIncludes_${suffix}`, [
        `    function _arrIncludes_${suffix}(${solType}[] storage arr, ${solType} ${memAnnotation}value) internal view returns (bool) {`,
        `        for (uint256 i = 0; i < arr.length; i++) {`,
        `            if (${eqCheck}) return true;`,
        `        }`,
        `        return false;`,
        `    }`,
      ]);
    }

    if (method === "indexOf" && needsHelper(`_arrIndexOf_${suffix}`, true)) {
      emitHelper(`_arrIndexOf_${suffix}`, [
        `    function _arrIndexOf_${suffix}(${solType}[] storage arr, ${solType} ${memAnnotation}value) internal view returns (uint256) {`,
        `        for (uint256 i = 0; i < arr.length; i++) {`,
        `            if (${eqCheck}) return i;`,
        `        }`,
        `        return type(uint256).max;`,
        `    }`,
      ]);
    }

    if (method === "lastIndexOf" && needsHelper(`_arrLastIndexOf_${suffix}`, true)) {
      emitHelper(`_arrLastIndexOf_${suffix}`, [
        `    function _arrLastIndexOf_${suffix}(${solType}[] storage arr, ${solType} ${memAnnotation}value) internal view returns (uint256) {`,
        `        for (uint256 i = arr.length; i > 0; i--) {`,
        `            if (${eqCheck.replace(/arr\[i\]/g, "arr[i - 1]")}) return i - 1;`,
        `        }`,
        `        return type(uint256).max;`,
        `    }`,
      ]);
    }

    if (method === "remove" && needsHelper(`_arrRemove_${suffix}`, true)) {
      emitHelper(`_arrRemove_${suffix}`, [
        `    function _arrRemove_${suffix}(${solType}[] storage arr, ${solType} ${memAnnotation}value) internal returns (bool) {`,
        `        for (uint256 i = 0; i < arr.length; i++) {`,
        `            if (${eqCheck}) {`,
        `                arr[i] = arr[arr.length - 1];`,
        `                arr.pop();`,
        `                return true;`,
        `            }`,
        `        }`,
        `        return false;`,
        `    }`,
      ]);
    }

    if (method === "reverse" && needsHelper(`_arrReverse_${suffix}`, true)) {
      emitHelper(`_arrReverse_${suffix}`, [
        `    function _arrReverse_${suffix}(${solType}[] storage arr) internal {`,
        `        uint256 len = arr.length;`,
        `        for (uint256 i = 0; i < len / 2; i++) {`,
        `            ${solType} ${memAnnotation}temp = arr[i];`,
        `            arr[i] = arr[len - 1 - i];`,
        `            arr[len - 1 - i] = temp;`,
        `        }`,
        `    }`,
      ]);
    }

    if (method === "splice" && needsHelper(`_arrSplice_${suffix}`, true)) {
      emitHelper(`_arrSplice_${suffix}`, [
        `    function _arrSplice_${suffix}(${solType}[] storage arr, uint256 start, uint256 deleteCount) internal {`,
        `        require(start < arr.length, "start out of bounds");`,
        `        uint256 end = start + deleteCount;`,
        `        if (end > arr.length) end = arr.length;`,
        `        uint256 removed = end - start;`,
        `        for (uint256 i = start; i < arr.length - removed; i++) {`,
        `            arr[i] = arr[i + removed];`,
        `        }`,
        `        for (uint256 i = 0; i < removed; i++) {`,
        `            arr.pop();`,
        `        }`,
        `    }`,
      ]);
    }

    if (method === "slice" && needsHelper(`_arrSlice_${suffix}`, true)) {
      emitHelper(`_arrSlice_${suffix}`, [
        `    function _arrSlice_${suffix}(${solType}[] storage arr, uint256 start, uint256 end) internal view returns (${solType}[] memory) {`,
        `        if (end > arr.length) end = arr.length;`,
        `        require(start <= end, "invalid slice range");`,
        `        ${solType}[] memory result = new ${solType}[](end - start);`,
        `        for (uint256 i = start; i < end; i++) {`,
        `            result[i - start] = arr[i];`,
        `        }`,
        `        return result;`,
        `    }`,
      ]);
    }

    if (method === "concat" && needsHelper(`_arrConcat_${suffix}`, true)) {
      emitHelper(`_arrConcat_${suffix}`, [
        `    function _arrConcat_${suffix}(${solType}[] storage arr, ${solType}[] memory other) internal view returns (${solType}[] memory) {`,
        `        ${solType}[] memory result = new ${solType}[](arr.length + other.length);`,
        `        for (uint256 i = 0; i < arr.length; i++) {`,
        `            result[i] = arr[i];`,
        `        }`,
        `        for (uint256 i = 0; i < other.length; i++) {`,
        `            result[arr.length + i] = other[i];`,
        `        }`,
        `        return result;`,
        `    }`,
      ]);
    }

    if (method === "spread" && needsHelper(`_arrSpread_${suffix}`, true)) {
      emitHelper(`_arrSpread_${suffix}`, [
        `    function _arrSpread_${suffix}(${solType}[] memory a, ${solType}[] memory b) internal pure returns (${solType}[] memory) {`,
        `        ${solType}[] memory result = new ${solType}[](a.length + b.length);`,
        `        for (uint256 i = 0; i < a.length; i++) {`,
        `            result[i] = a[i];`,
        `        }`,
        `        for (uint256 i = 0; i < b.length; i++) {`,
        `            result[a.length + i] = b[i];`,
        `        }`,
        `        return result;`,
        `    }`,
      ]);
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
      return expressionMayModifyState(expr.left) || expressionMayModifyState(expr.right);
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
      return expressionMayModifyState(expr.object) || expressionMayModifyState(expr.index);
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
function expandDefaultParamOverloads(f: SkittlesFunction): SkittlesFunction[] {
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
  for (let paramCount = f.parameters.length - 1; paramCount >= firstDefaultIdx; paramCount--) {
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
    const omittedDefaults = f.parameters.slice(paramCount).map((p) => p.defaultValue!);
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
              `such defaults.`,
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

function generateConstructor(c: SkittlesConstructor, inherits: string[] = []): string {
  const regularParams = c.parameters.filter((p) => !p.defaultValue);
  const defaultParams = c.parameters.filter((p) => p.defaultValue);

  const params = regularParams
    .map((p) => `${generateParamType(p.type)} ${p.name}`)
    .join(", ");

  // Extract super() call(s) from the body and validate.
  const superCalls = c.body.filter(isSuperCall);
  if (superCalls.length > 1) {
    throw new Error("Constructor contains multiple super() calls, but only one is allowed");
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
    lines.push(`        ${generateParamType(p.type)} ${p.name} = ${generateExpression(p.defaultValue!)};`);
  }
  for (const s of bodyWithoutSuper) {
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
      if (ADDRESS_LITERAL_RE.test(expr.value)) {
        return `address(${expr.value})`;
      }
      const escaped = expr.value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/[\x00-\x1f\x7f]/g, (ch) => {
          const hex = ch.charCodeAt(0).toString(16).padStart(2, "0");
          return `\\x${hex}`;
        });
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

    case "tuple-destructuring": {
      const parts = stmt.names.map((name, i) => {
        if (name === null) return "";
        const elemType = i < stmt.types.length ? stmt.types[i] : null;
        const type = elemType !== null ? generateParamType(elemType) : "uint256";
        return `${type} ${name}`;
      });
      const initExpr = generateExpression(stmt.initializer);
      return `${indent}(${parts.join(", ")}) = ${initExpr};`;
    }

    case "expression": {
      if (stmt.expression.kind === "conditional" && indent) {
        const conditionalExpr = stmt.expression;
        const lines: string[] = [];
        lines.push(`${indent}if (${generateExpression(conditionalExpr.condition)}) {`);
        lines.push(
          generateStatement(
            { kind: "expression", expression: conditionalExpr.whenTrue },
            inner,
          ),
        );
        lines.push(`${indent}} else {`);
        lines.push(
          generateStatement(
            { kind: "expression", expression: conditionalExpr.whenFalse },
            inner,
          ),
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
    case "ecrecover": {
      const [hashArg, vArg, rArg, sArg] = expr.args.map(generateExpression);
      return `ecrecover(${hashArg}, uint8(${vArg}), ${rArg}, ${sArg})`;
    }
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
    case "__sk_toString": {
      _needsToStringHelper = true;
      return `__sk_toString(${args})`;
    }
    case "Math.min": {
      _needsMinHelper = true;
      const a = generateExpression(expr.args[0]);
      const b = generateExpression(expr.args[1]);
      return `_min(${a}, ${b})`;
    }
    case "Math.max": {
      _needsMaxHelper = true;
      const a = generateExpression(expr.args[0]);
      const b = generateExpression(expr.args[1]);
      return `_max(${a}, ${b})`;
    }
    case "Math.pow": {
      const base = generateExpression(expr.args[0]);
      const exp = generateExpression(expr.args[1]);
      return `(${base} ** ${exp})`;
    }
    case "Math.sqrt": {
      _needsSqrtHelper = true;
      const x = generateExpression(expr.args[0]);
      return `_sqrt(${x})`;
    }
    case "_charAt": {
      _needsCharAtHelper = true;
      return `_charAt(${args})`;
    }
    case "_substring": {
      _needsSubstringHelper = true;
      return `_substring(${args})`;
    }
    case "_toLowerCase": {
      _needsToLowerCaseHelper = true;
      return `_toLowerCase(${args})`;
    }
    case "_toUpperCase": {
      _needsToUpperCaseHelper = true;
      return `_toUpperCase(${args})`;
    }
    case "_startsWith": {
      _needsStartsWithHelper = true;
      return `_startsWith(${args})`;
    }
    case "_endsWith": {
      _needsEndsWithHelper = true;
      return `_endsWith(${args})`;
    }
    case "_trim": {
      _needsTrimHelper = true;
      return `_trim(${args})`;
    }
    case "_split": {
      _needsSplitHelper = true;
      return `_split(${args})`;
    }
    case "_replace": {
      _needsReplaceHelper = true;
      return `_replace(${args})`;
    }
    case "_replaceAll": {
      _needsReplaceAllHelper = true;
      return `_replaceAll(${args})`;
    }
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
      } else if (stmt.kind === "expression" && stmt.expression.kind === "conditional" && indent) {
        // Lowered void ternary: map all generated lines to the original source line
        for (let i = 1; i < stmtLineCount; i++) {
          addMapping(currentIdx + i, stmt.sourceLine);
        }
      } else if (stmt.kind === "for" || stmt.kind === "while") {
        mapBodyStatements(stmt.body, currentIdx + 1, indent + "    ");
      } else if (stmt.kind === "do-while") {
        mapBodyStatements(stmt.body, currentIdx + 1, indent + "    ");
      }

      currentIdx += stmtLineCount;
    }
  }

  // Replicate the same ancestor-origin suppression used during codegen so we
  // only try to map functions that were actually emitted in the Solidity output.
  const contractByName = new Map(contracts.map((c) => [c.name, c] as const));
  const smAncestorsMap = new Map<string, Set<string>>();
  for (const c of contracts) {
    const ancestors = new Set<string>();
    const queue = [...c.inherits.filter((n) => contractByName.has(n))];
    let qi = 0;
    while (qi < queue.length) {
      const name = queue[qi++]!;
      if (ancestors.has(name)) continue;
      ancestors.add(name);
      const parent = contractByName.get(name);
      if (parent) {
        for (const gp of parent.inherits) {
          if (contractByName.has(gp)) queue.push(gp);
        }
      }
    }
    smAncestorsMap.set(c.name, ancestors);
  }
  const smFunctionOrigins = new Map<string, Set<string>>();

  for (const contract of contracts) {
    const smAncestors = smAncestorsMap.get(contract.name) ?? new Set<string>();
    const smHasAncestorOrigin = (origins: Set<string> | undefined): boolean =>
      origins !== undefined && Array.from(origins).some((o) => smAncestors.has(o));
    const smGetFunctionKey = (f: SkittlesFunction): string => {
      const paramTypes = f.parameters
        .map((p) => (p.type ? generateType(p.type) : "unknown"))
        .join(",");
      return `${f.name}(${paramTypes})`;
    };

    const functionsToMap = contract.functions.filter((f) => {
      const key = smGetFunctionKey(f);
      return !smHasAncestorOrigin(smFunctionOrigins.get(key)) || f.isOverride;
    });
    for (const f of functionsToMap) {
      const key = smGetFunctionKey(f);
      let origins = smFunctionOrigins.get(key);
      if (!origins) {
        origins = new Set<string>();
        smFunctionOrigins.set(key, origins);
      }
      origins.add(contract.name);
    }

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

    // Map functions — expand default-param overloads so the source map
    // scanner advances past overload wrapper bodies that appear in the
    // generated Solidity (the same expansion is applied during codegen).
    const expandedFns: SkittlesFunction[] = [];
    for (const f of functionsToMap) {
      expandedFns.push(...expandDefaultParamOverloads(f));
    }
    for (const f of expandedFns) {
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
