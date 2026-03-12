import ts from "typescript";
import {
  SkittlesTypeKind,
  type SkittlesContract,
  type SkittlesVariable,
  type SkittlesFunction,
  type SkittlesConstructor,
  type SkittlesEvent,
  type SkittlesParameter,
  type SkittlesType,
  type SkittlesContractInterface,
  type SkittlesInterfaceFunction,
  type Statement,
  type Expression,
} from "../types/index.ts";
import { ctx } from "./parser-context.ts";
import {
  getSourceLine,
  setupStringTracking,
  validateReservedName,
  validateReservedVarName,
  getVisibility,
  hasModifier,
} from "./parser-utils.ts";
import { parseType, inferType, parseTypeLiteralFields } from "./type-parser.ts";
import { parseExpression } from "./expression-parser.ts";
import {
  parseStatement,
  parseBlock,
  parseStatements,
} from "./statement-parser.ts";
import {
  propagateStateMutability,
  walkStatements,
  collectExternalInterfaceCalls,
  inferAbstractStateMutability,
  rewriteInterfacePropertyGetters,
  inferStateMutability,
  collectContractInterfaceTypeRefs,
  collectBodyContractInterfaceRefs,
} from "./mutability.ts";

export function parseStandaloneFunction(
  node: ts.FunctionDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name = node.name ? node.name.text : "unknown";

  validateReservedName("Function name", name);

  const parameters = node.parameters.map(parseParameter);
  // Clone varTypes to create a per-function scope that won't leak locals to other methods
  const localVarTypes = new Map(varTypes);
  setupStringTracking(parameters, localVarTypes);
  const returnType: SkittlesType | null = node.type
    ? parseType(node.type)
    : null;
  const body = node.body
    ? parseBlock(node.body, localVarTypes, eventNames)
    : [];
  const stateMutability = inferStateMutability(body, localVarTypes, parameters);

  return {
    name,
    parameters,
    returnType,
    visibility: "private",
    stateMutability,
    isVirtual: false,
    isOverride: false,
    body,
    sourceLine: getSourceLine(node),
  };
}

export function parseStandaloneArrowFunction(
  decl: ts.VariableDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name = ts.isIdentifier(decl.name) ? decl.name.text : "unknown";

  validateReservedVarName(name);

  const arrow = decl.initializer as ts.ArrowFunction;
  const parameters = arrow.parameters.map(parseParameter);
  // Clone varTypes to create a per-function scope that won't leak locals to other methods
  const localVarTypes = new Map(varTypes);
  setupStringTracking(parameters, localVarTypes);
  const returnType: SkittlesType | null = arrow.type
    ? parseType(arrow.type)
    : null;

  let body: Statement[] = [];
  if (arrow.body) {
    if (ts.isBlock(arrow.body)) {
      body = parseBlock(arrow.body, localVarTypes, eventNames);
    } else {
      body = [{ kind: "return" as const, value: parseExpression(arrow.body) }];
    }
  }

  const stateMutability = inferStateMutability(body, localVarTypes, parameters);

  return {
    name,
    parameters,
    returnType,
    visibility: "private",
    stateMutability,
    isVirtual: false,
    isOverride: false,
    body,
    sourceLine: getSourceLine(decl),
  };
}

export function extendsError(node: ts.ClassDeclaration): boolean {
  if (!node.heritageClauses) return false;
  return node.heritageClauses.some(
    (clause) =>
      clause.token === ts.SyntaxKind.ExtendsKeyword &&
      clause.types.some(
        (t) => ts.isIdentifier(t.expression) && t.expression.text === "Error"
      )
  );
}

export function parseErrorClass(
  node: ts.ClassDeclaration
): SkittlesParameter[] {
  for (const member of node.members) {
    if (ts.isConstructorDeclaration(member)) {
      return member.parameters.map(parseParameter);
    }
  }
  return [];
}

export function parseInterfaceAsContractInterface(
  node: ts.InterfaceDeclaration
): SkittlesContractInterface {
  const name = node.name.text;
  const functions: SkittlesInterfaceFunction[] = [];

  for (const member of node.members) {
    if (
      ts.isPropertySignature(member) &&
      member.name &&
      ts.isIdentifier(member.name)
    ) {
      const propName = member.name.text;
      const returnType: SkittlesType = member.type
        ? parseType(member.type)
        : { kind: SkittlesTypeKind.Uint256 };
      functions.push({
        name: propName,
        parameters: [],
        returnType,
        stateMutability: "view",
      });
    }

    if (
      ts.isMethodSignature(member) &&
      member.name &&
      ts.isIdentifier(member.name)
    ) {
      const methodName = member.name.text;
      const parameters = member.parameters.map(parseParameter);
      const returnType: SkittlesType | null = member.type
        ? parseType(member.type)
        : null;
      functions.push({ name: methodName, parameters, returnType });
    }
  }

  return { name, functions };
}

// ============================================================
// Class level parsing
// ============================================================

export function parseClass(
  node: ts.ClassDeclaration,
  filePath: string,
  knownStructs: Map<string, SkittlesParameter[]> = new Map(),
  knownEnums: Map<string, string[]> = new Map(),
  knownContractInterfaces: Map<string, SkittlesContractInterface> = new Map(),
  knownCustomErrors: Map<string, SkittlesParameter[]> = new Map(),
  fileFunctions: SkittlesFunction[] = [],
  fileConstants: Map<string, Expression> = new Map()
): SkittlesContract {
  const name = node.name?.text ?? "Unknown";
  const isAbstract = hasModifier(node.modifiers, ts.SyntaxKind.AbstractKeyword);
  const variables: SkittlesVariable[] = [];
  const functions: SkittlesFunction[] = [];
  const events: SkittlesEvent[] = [];
  let ctor: SkittlesConstructor | undefined;
  const inherits: string[] = [];

  // Reset per-contract array method state (counter stays file-global to avoid
  // name collisions across inherited contracts emitted into the same file)
  ctx.generatedArrayFunctions = [];
  ctx.neededArrayHelpers = new Set();

  if (node.heritageClauses) {
    for (const clause of node.heritageClauses) {
      if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
        for (const type of clause.types) {
          if (ts.isIdentifier(type.expression)) {
            inherits.push(type.expression.text);
          }
        }
      }
      if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
        for (const type of clause.types) {
          if (ts.isIdentifier(type.expression)) {
            inherits.push(type.expression.text);
          }
        }
      }
    }
  }

  // Collect arrow function properties separately so they can be parsed as methods
  const arrowFnMembers: ts.PropertyDeclaration[] = [];

  // Inline errors declared via SkittlesError<{...}> on the class
  const inlineErrors: { name: string; parameters: SkittlesParameter[] }[] = [];

  // First pass: collect state variables, events, and inline errors.
  // Split into two sub-passes: collect name/type first so ctx.stateVarTypes
  // is populated before parsing initializers (which may contain template
  // literals that reference other state variables via `this.<prop>`).
  const propertyMembers: ts.PropertyDeclaration[] = [];
  for (const member of node.members) {
    if (ts.isPropertyDeclaration(member)) {
      // Detect arrow function properties: `private _fn = (...) => { ... }`
      if (member.initializer && ts.isArrowFunction(member.initializer)) {
        arrowFnMembers.push(member);
      } else {
        const event = tryParseEvent(member);
        if (event) {
          events.push(event);
          continue;
        }
        const error = tryParseError(member);
        if (error) {
          inlineErrors.push(error);
          ctx.knownCustomErrors.add(error.name);
          continue;
        }
        propertyMembers.push(member);
      }
    }
  }

  // Sub-pass 1: collect name + type (without initializers) to build ctx.stateVarTypes.
  const varTypes = new Map<string, SkittlesType>();
  for (const member of propertyMembers) {
    const name =
      member.name && ts.isIdentifier(member.name)
        ? member.name.text
        : "unknown";
    const type: SkittlesType = member.type
      ? parseType(member.type)
      : { kind: SkittlesTypeKind.Uint256 };
    varTypes.set(name, type);
  }
  // Snapshot the state-variable-only map before any initializers/locals/params are parsed.
  ctx.stateVarTypes = new Map(varTypes);

  // Reset string-tracking caches so that property initializers are parsed
  // with a clean, contract-appropriate scope (no stale params/locals from
  // previously parsed standalone functions).
  setupStringTracking([], varTypes);

  // Sub-pass 2: parse full property declarations (including initializers).
  for (const member of propertyMembers) {
    variables.push(parseProperty(member));
  }

  const eventNames = new Set(events.map((e) => e.name));
  ctx.currentEventNames = eventNames;

  // Second pass: methods (instance and static), constructor, and arrow function properties
  // Group method declarations by static/instance + name to detect overloads
  const methodGroups = new Map<string, ts.MethodDeclaration[]>();
  const methodOrder: string[] = [];

  for (const member of node.members) {
    if (ts.isMethodDeclaration(member)) {
      const name =
        member.name && ts.isIdentifier(member.name)
          ? member.name.text
          : "unknown";
      const isStatic = hasModifier(
        member.modifiers,
        ts.SyntaxKind.StaticKeyword
      );
      const key = `${isStatic ? "static" : "instance"}:${name}`;
      if (!methodGroups.has(key)) {
        methodGroups.set(key, []);
        methodOrder.push(key);
      }
      methodGroups.get(key)!.push(member);
    } else if (ts.isConstructorDeclaration(member)) {
      ctor = parseConstructorDecl(member, varTypes, eventNames);
    }
  }

  for (const key of methodOrder) {
    const decls = methodGroups.get(key)!;
    const name = key.split(":").slice(1).join(":");
    const overloadSigs = decls.filter(
      (d) => !d.body && !hasModifier(d.modifiers, ts.SyntaxKind.AbstractKeyword)
    );
    const impls = decls.filter((d) => !!d.body);

    if (overloadSigs.length > 0) {
      if (impls.length !== 1) {
        throw new Error(
          `Method "${name}" has ${overloadSigs.length} overload signature(s) but ${impls.length} implementation(s); ` +
            "expected exactly one implementation for an overloaded method."
        );
      }
      // Overloaded method: resolve signatures with the single implementation body
      resolveOverloadedMethods(
        overloadSigs,
        impls[0],
        varTypes,
        eventNames,
        functions
      );
    } else {
      // Normal methods (no overloading)
      for (const decl of decls) {
        const isStatic = hasModifier(
          decl.modifiers,
          ts.SyntaxKind.StaticKeyword
        );
        const fn = parseMethod(decl, varTypes, eventNames);
        // Static methods are internal pure/view helpers
        if (isStatic) {
          fn.visibility = "private";
        }
        functions.push(fn);
      }
    }
  }

  // Parse arrow function properties as methods
  for (const member of arrowFnMembers) {
    functions.push(parseArrowProperty(member, varTypes, eventNames));
  }

  // Parse getter/setter accessors as methods
  for (const member of node.members) {
    if (ts.isGetAccessorDeclaration(member)) {
      functions.push(parseGetAccessor(member, varTypes, eventNames));
    } else if (ts.isSetAccessorDeclaration(member)) {
      functions.push(parseSetAccessor(member, varTypes, eventNames));
    }
  }

  // Inject generated array method helper functions
  for (const fn of ctx.generatedArrayFunctions) {
    if (!functions.some((f) => f.name === fn.name)) {
      functions.push(fn);
    }
  }

  // Inject only file level standalone functions that are actually used by this contract.
  // First, collect function names called directly by class methods, constructor, and variable initializers.
  const fileFnNames = new Set(fileFunctions.map((f) => f.name));
  const usedFileFnNames = new Set<string>();
  const collectFnCalls = (stmts: Statement[]) => {
    walkStatements(stmts, (expr) => {
      if (
        expr.kind === "call" &&
        expr.callee.kind === "identifier" &&
        fileFnNames.has(expr.callee.name)
      ) {
        usedFileFnNames.add(expr.callee.name);
      }
    });
  };
  for (const f of functions) collectFnCalls(f.body);
  if (ctor) collectFnCalls(ctor.body);
  for (const v of variables) {
    if (v.initialValue) {
      walkStatements(
        [{ kind: "expression", expression: v.initialValue }],
        (expr) => {
          if (
            expr.kind === "call" &&
            expr.callee.kind === "identifier" &&
            fileFnNames.has(expr.callee.name)
          ) {
            usedFileFnNames.add(expr.callee.name);
          }
        }
      );
    }
  }
  // Transitively include file functions called by other used file functions
  let fnChanged = true;
  while (fnChanged) {
    fnChanged = false;
    for (const fn of fileFunctions) {
      if (!usedFileFnNames.has(fn.name)) continue;
      walkStatements(fn.body, (expr) => {
        if (
          expr.kind === "call" &&
          expr.callee.kind === "identifier" &&
          fileFnNames.has(expr.callee.name) &&
          !usedFileFnNames.has(expr.callee.name)
        ) {
          usedFileFnNames.add(expr.callee.name);
          fnChanged = true;
        }
      });
    }
  }
  for (const fn of fileFunctions) {
    if (!usedFileFnNames.has(fn.name)) continue;
    if (!functions.some((f) => f.name === fn.name)) {
      functions.push(fn);
    }
  }

  // Third pass: propagate state mutability through call chains.
  // If function A calls this.B(), and B is nonpayable, then A is also nonpayable.
  propagateStateMutability(functions);

  // Build set of interface names this class implements
  const implementedInterfaceNames = new Set<string>();
  if (node.heritageClauses) {
    for (const clause of node.heritageClauses) {
      if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
        for (const type of clause.types) {
          if (
            ts.isIdentifier(type.expression) &&
            knownContractInterfaces.has(type.expression.text)
          ) {
            implementedInterfaceNames.add(type.expression.text);
          }
        }
      }
    }
  }

  // Determine which structs and enums are actually referenced by this contract
  const usedStructNames = new Set<string>();
  const usedEnumNames = new Set<string>();
  const collectTypeRef = (type: SkittlesType | null | undefined) => {
    if (!type) return;
    if (type.kind === SkittlesTypeKind.Struct && type.structName)
      usedStructNames.add(type.structName);
    if (type.kind === SkittlesTypeKind.Enum && type.structName)
      usedEnumNames.add(type.structName);
    if (type.keyType) collectTypeRef(type.keyType);
    if (type.valueType) collectTypeRef(type.valueType);
    if (type.tupleTypes) for (const t of type.tupleTypes) collectTypeRef(t);
    // Include struct field types transitively
    if (type.structFields)
      for (const f of type.structFields) collectTypeRef(f.type);
  };
  const collectBodyTypeRefs = (stmts: Statement[]) => {
    walkStatements(
      stmts,
      (expr) => {
        // Enum member access: Color.Red
        if (
          expr.kind === "property-access" &&
          expr.object.kind === "identifier" &&
          knownEnums.has(expr.object.name)
        ) {
          usedEnumNames.add(expr.object.name);
        }
        // Type arguments on call expressions (e.g. contract interface casts)
        if (expr.kind === "call" && expr.typeArgs) {
          for (const t of expr.typeArgs) collectTypeRef(t);
        }
      },
      (stmt) => {
        if (stmt.kind === "variable-declaration" && stmt.type)
          collectTypeRef(stmt.type);
        if (stmt.kind === "try-catch" && stmt.returnType)
          collectTypeRef(stmt.returnType);
      }
    );
  };
  for (const v of variables) {
    collectTypeRef(v.type);
    if (v.initialValue)
      collectBodyTypeRefs([{ kind: "expression", expression: v.initialValue }]);
  }
  for (const f of functions) {
    for (const p of f.parameters) collectTypeRef(p.type);
    if (f.returnType) collectTypeRef(f.returnType);
    collectBodyTypeRefs(f.body);
  }
  if (ctor) {
    for (const p of ctor.parameters) collectTypeRef(p.type);
    collectBodyTypeRefs(ctor.body);
  }
  for (const e of events) {
    for (const p of e.parameters) collectTypeRef(p.type);
  }

  // Transitively include structs whose fields reference other structs/enums
  let typeChanged = true;
  while (typeChanged) {
    typeChanged = false;
    for (const sName of usedStructNames) {
      const fields = knownStructs.get(sName);
      if (!fields) continue;
      for (const field of fields) {
        const sizeBefore = usedStructNames.size + usedEnumNames.size;
        collectTypeRef(field.type);
        if (usedStructNames.size + usedEnumNames.size > sizeBefore)
          typeChanged = true;
      }
    }
  }

  const contractStructs: { name: string; fields: SkittlesParameter[] }[] = [];
  for (const [sName, fields] of knownStructs) {
    if (usedStructNames.has(sName))
      contractStructs.push({ name: sName, fields });
  }

  const contractEnums: { name: string; members: string[] }[] = [];
  for (const [eName, members] of knownEnums) {
    if (usedEnumNames.has(eName)) contractEnums.push({ name: eName, members });
  }

  // Determine which interfaces this contract actually references
  const usedIfaceNames = new Set<string>();
  for (const iName of inherits) {
    if (knownContractInterfaces.has(iName)) usedIfaceNames.add(iName);
  }
  for (const v of variables) {
    collectContractInterfaceTypeRefs(v.type, usedIfaceNames);
  }
  for (const f of functions) {
    for (const p of f.parameters)
      collectContractInterfaceTypeRefs(p.type, usedIfaceNames);
    if (f.returnType)
      collectContractInterfaceTypeRefs(f.returnType, usedIfaceNames);
    collectBodyContractInterfaceRefs(f.body, usedIfaceNames);
  }
  if (ctor) {
    for (const p of ctor.parameters)
      collectContractInterfaceTypeRefs(p.type, usedIfaceNames);
    collectBodyContractInterfaceRefs(ctor.body, usedIfaceNames);
  }

  // Deep copy only used interfaces so mutability updates don't leak to shared state
  const contractIfaceList: SkittlesContractInterface[] = [];
  for (const ifName of usedIfaceNames) {
    const iface = knownContractInterfaces.get(ifName);
    if (iface) {
      contractIfaceList.push({
        name: iface.name,
        functions: iface.functions.map((fn) => ({ ...fn })),
      });
    }
  }

  // Fourth pass: for implemented interfaces, derive method mutabilities
  // from the actual implementation and mark implementing members as override.
  if (implementedInterfaceNames.size > 0) {
    const interfaceFnNames = new Set<string>();
    for (const ifaceName of implementedInterfaceNames) {
      const iface = contractIfaceList.find((i) => i.name === ifaceName);
      if (!iface) continue;
      for (const ifn of iface.functions) {
        interfaceFnNames.add(ifn.name);
        if (ifn.stateMutability) continue;
        const impl = functions.find((f) => f.name === ifn.name);
        if (impl) {
          ifn.stateMutability = impl.stateMutability;
        } else {
          const varImpl = variables.find(
            (v) => v.name === ifn.name && v.visibility === "public"
          );
          if (varImpl) {
            ifn.stateMutability = "view";
          }
        }
      }
    }

    for (const fn of functions) {
      if (interfaceFnNames.has(fn.name)) {
        fn.isOverride = true;
        fn.isVirtual = false;
      }
    }
    for (const v of variables) {
      if (
        v.visibility === "public" &&
        interfaceFnNames.has(v.name) &&
        !v.constant &&
        !v.immutable
      ) {
        v.isOverride = true;
      }
    }
  }

  // Fifth pass: propagate already-known interface method mutabilities to callers.
  // Only treat external calls as view/pure if the target interface methods are
  // already explicitly annotated as view or pure (e.g. from an `implements`
  // resolution or property signatures). Do not infer view for unannotated
  // interface methods based on wrapper patterns, to avoid misclassifying
  // state-changing methods that return a value (e.g. ERC20 `transfer`).
  for (const fn of functions) {
    const fnVarTypes = new Map(varTypes);
    for (const p of fn.parameters) {
      fnVarTypes.set(p.name, p.type);
    }
    const externalCalls = collectExternalInterfaceCalls(
      fn.body,
      varTypes,
      fnVarTypes
    );
    if (externalCalls.length === 0) continue;

    let allExternalAreViewLike = true;
    let externalNeedsView = false;
    for (const { ifaceName, methodName } of externalCalls) {
      const iface = contractIfaceList.find((i) => i.name === ifaceName);
      if (!iface) {
        allExternalAreViewLike = false;
        break;
      }
      const ifaceMethod = iface.functions.find((f) => f.name === methodName);
      if (
        !ifaceMethod ||
        (ifaceMethod.stateMutability !== "view" &&
          ifaceMethod.stateMutability !== "pure")
      ) {
        allExternalAreViewLike = false;
        break;
      }
      if (ifaceMethod.stateMutability === "view") {
        externalNeedsView = true;
      }
    }
    if (!allExternalAreViewLike) continue;

    // All external calls are to explicitly view/pure methods, so the wrapper
    // itself can safely be marked with the base mutability (or at least view
    // when any external call is view, e.g. for local interface variables).
    const baseMut = inferStateMutability(
      fn.body,
      varTypes,
      fn.parameters,
      true
    );
    if (baseMut === "view" || baseMut === "pure") {
      fn.stateMutability =
        baseMut === "pure" && externalNeedsView ? "view" : baseMut;
    }
  }

  const contractCustomErrors: {
    name: string;
    parameters: SkittlesParameter[];
  }[] = [];
  for (const [cName, params] of knownCustomErrors) {
    contractCustomErrors.push({ name: cName, parameters: params });
  }
  // Add inline SkittlesError<{...}> declarations from this class
  for (const ie of inlineErrors) {
    contractCustomErrors.push({ name: ie.name, parameters: ie.parameters });
  }

  return {
    name,
    sourcePath: filePath,
    variables,
    functions,
    events,
    structs: contractStructs,
    enums: contractEnums,
    contractInterfaces: contractIfaceList,
    customErrors: contractCustomErrors,
    ctor,
    inherits,
    isAbstract,
    sourceLine: getSourceLine(node),
    neededArrayHelpers:
      ctx.neededArrayHelpers.size > 0 ? [...ctx.neededArrayHelpers] : undefined,
  };
}

export function tryParseEvent(
  node: ts.PropertyDeclaration
): SkittlesEvent | null {
  if (!node.type || !ts.isTypeReferenceNode(node.type)) return null;

  const typeName = ts.isIdentifier(node.type.typeName)
    ? node.type.typeName.text
    : "";
  if (typeName !== "SkittlesEvent" && typeName !== "Event") return null;

  const name =
    node.name && ts.isIdentifier(node.name) ? node.name.text : "Unknown";

  if (!node.type.typeArguments || node.type.typeArguments.length === 0) {
    return { name, parameters: [], sourceLine: getSourceLine(node) };
  }

  const typeArg = node.type.typeArguments[0];
  if (!ts.isTypeLiteralNode(typeArg)) {
    return { name, parameters: [], sourceLine: getSourceLine(node) };
  }

  const parameters: SkittlesParameter[] = [];
  for (const member of typeArg.members) {
    if (
      ts.isPropertySignature(member) &&
      member.name &&
      ts.isIdentifier(member.name)
    ) {
      const paramName = member.name.text;
      let indexed = false;
      let typeNode = member.type;

      if (
        typeNode &&
        ts.isTypeReferenceNode(typeNode) &&
        ts.isIdentifier(typeNode.typeName) &&
        typeNode.typeName.text === "Indexed" &&
        typeNode.typeArguments &&
        typeNode.typeArguments.length === 1
      ) {
        indexed = true;
        typeNode = typeNode.typeArguments[0];
      }

      const paramType: SkittlesType = typeNode
        ? parseType(typeNode)
        : { kind: SkittlesTypeKind.Uint256 };
      parameters.push({ name: paramName, type: paramType, indexed });
    }
  }

  return { name, parameters, sourceLine: getSourceLine(node) };
}

// ============================================================
// Error detection (SkittlesError<{...}>)
// ============================================================

export function tryParseError(
  node: ts.PropertyDeclaration
): { name: string; parameters: SkittlesParameter[] } | null {
  if (!node.type || !ts.isTypeReferenceNode(node.type)) return null;

  const typeName = ts.isIdentifier(node.type.typeName)
    ? node.type.typeName.text
    : "";
  if (typeName !== "SkittlesError") return null;

  const name =
    node.name && ts.isIdentifier(node.name) ? node.name.text : "Unknown";

  if (!node.type.typeArguments || node.type.typeArguments.length === 0) {
    return { name, parameters: [] };
  }

  const typeArg = node.type.typeArguments[0];
  if (!ts.isTypeLiteralNode(typeArg)) {
    return { name, parameters: [] };
  }

  const parameters: SkittlesParameter[] = [];
  for (const member of typeArg.members) {
    if (
      ts.isPropertySignature(member) &&
      member.name &&
      ts.isIdentifier(member.name)
    ) {
      const paramName = member.name.text;
      const paramType: SkittlesType = member.type
        ? parseType(member.type)
        : { kind: SkittlesTypeKind.Uint256 };
      parameters.push({ name: paramName, type: paramType });
    }
  }

  return { name, parameters };
}

export function parseProperty(node: ts.PropertyDeclaration): SkittlesVariable {
  const name =
    node.name && ts.isIdentifier(node.name) ? node.name.text : "unknown";

  validateReservedName("Property name", name);

  const type: SkittlesType = node.type
    ? parseType(node.type)
    : { kind: SkittlesTypeKind.Uint256 };

  const visibility = getVisibility(node.modifiers);
  const isStatic = hasModifier(node.modifiers, ts.SyntaxKind.StaticKeyword);
  const isReadonly = hasModifier(node.modifiers, ts.SyntaxKind.ReadonlyKeyword);
  const constant = isStatic && isReadonly;
  const immutable = !isStatic && isReadonly;

  let initialValue: Expression | undefined;
  if (node.initializer) {
    if (
      ts.isObjectLiteralExpression(node.initializer) ||
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      // Skip: mappings and arrays have no initializers in Solidity
    } else {
      initialValue = parseExpression(node.initializer);
    }
  }

  return {
    name,
    type,
    visibility,
    immutable,
    constant,
    initialValue,
    sourceLine: getSourceLine(node),
  };
}

export function parseMethod(
  node: ts.MethodDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name =
    node.name && ts.isIdentifier(node.name) ? node.name.text : "unknown";

  validateReservedName("Method name", name);

  const parameters = node.parameters.map(parseParameter);
  // Clone varTypes to create a per-function scope that won't leak locals to other methods
  const localVarTypes = new Map(varTypes);
  setupStringTracking(parameters, localVarTypes);
  const returnType: SkittlesType | null = node.type
    ? parseType(node.type)
    : null;
  const visibility = getVisibility(node.modifiers);
  const isAbstractMethod = hasModifier(
    node.modifiers,
    ts.SyntaxKind.AbstractKeyword
  );
  const rawBody = node.body
    ? parseBlock(node.body, localVarTypes, eventNames)
    : [];
  const body = rewriteInterfacePropertyGetters(
    rawBody,
    localVarTypes,
    parameters
  );
  const stateMutability = isAbstractMethod
    ? inferAbstractStateMutability()
    : inferStateMutability(body, localVarTypes, parameters);

  const isOverride = hasModifier(node.modifiers, ts.SyntaxKind.OverrideKeyword);
  const isVirtual = !isOverride;

  return {
    name,
    parameters,
    returnType,
    visibility,
    stateMutability,
    isVirtual,
    isOverride,
    isAbstract: isAbstractMethod ? true : undefined,
    body,
    sourceLine: getSourceLine(node),
  };
}

export function resolveOverloadedMethods(
  overloadSigs: ts.MethodDeclaration[],
  impl: ts.MethodDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>,
  functions: SkittlesFunction[]
): void {
  const implFn = parseMethod(impl, varTypes, eventNames);
  const isStatic = hasModifier(impl.modifiers, ts.SyntaxKind.StaticKeyword);

  // Sort overload signatures by parameter count (most params last)
  const sortedSigs = [...overloadSigs].sort(
    (a, b) => a.parameters.length - b.parameters.length
  );

  // Reject overload sets where multiple signatures share the same parameter count
  const paramCounts = sortedSigs.map((s) => s.parameters.length);
  const uniqueCounts = new Set(paramCounts);
  if (uniqueCounts.size !== paramCounts.length) {
    const name =
      impl.name && ts.isIdentifier(impl.name) ? impl.name.text : "unknown";
    throw new Error(
      `Method "${name}" has multiple overload signatures with the same parameter count. ` +
        "Skittles only supports overloads distinguished by parameter count."
    );
  }

  const longestSig = sortedSigs[sortedSigs.length - 1];
  const longestParams = longestSig.parameters.map(parseParameter);

  // Validate that implementation has the same parameter count as the longest overload
  if (impl.parameters.length !== longestSig.parameters.length) {
    const name =
      impl.name && ts.isIdentifier(impl.name) ? impl.name.text : "unknown";
    throw new Error(
      `Method "${name}" implementation has ${impl.parameters.length} parameter(s) but the longest overload signature has ${longestSig.parameters.length}. ` +
        "The implementation must have the same number of parameters as the longest overload signature."
    );
  }

  for (const sig of sortedSigs) {
    const sigFn = parseMethod(sig, varTypes, eventNames);

    // Inherit visibility and override/virtual from implementation
    sigFn.visibility = implFn.visibility;
    sigFn.isOverride = implFn.isOverride;
    sigFn.isVirtual = implFn.isVirtual;

    if (sig === longestSig) {
      // Longest overload gets the implementation body.
      // Ensure parameter names come from the implementation so that the
      // body does not reference undeclared identifiers when overload
      // signature parameter names differ from the implementation's.
      const minParamLen = Math.min(
        sigFn.parameters.length,
        implFn.parameters.length
      );
      for (let i = 0; i < minParamLen; i++) {
        sigFn.parameters[i].name = implFn.parameters[i].name;
      }
      sigFn.body = implFn.body;
      sigFn.stateMutability = implFn.stateMutability;
    } else {
      // Shorter overloads forward to the longest overload with type defaults
      sigFn.body = buildOverloadForwardingBody(
        sigFn.name,
        sigFn.parameters,
        longestParams,
        implFn,
        sigFn.returnType
      );
      sigFn.stateMutability = implFn.stateMutability;
    }

    if (isStatic) sigFn.visibility = "private";
    functions.push(sigFn);
  }
}

export function buildOverloadForwardingBody(
  fnName: string,
  shortParams: SkittlesParameter[],
  longParams: SkittlesParameter[],
  implFn: SkittlesFunction,
  returnType: SkittlesType | null
): Statement[] {
  const args: Expression[] = [];

  for (let i = 0; i < longParams.length; i++) {
    if (i < shortParams.length) {
      args.push({ kind: "identifier", name: shortParams[i].name });
    } else {
      // Use implementation default value if available, else type default
      const implParam = implFn.parameters[i];
      if (implParam?.defaultValue) {
        args.push(implParam.defaultValue);
      } else {
        args.push(getDefaultValueForType(longParams[i].type));
      }
    }
  }

  const callExpr: Expression = {
    kind: "call",
    callee: { kind: "identifier", name: fnName },
    args,
  };

  if (returnType && returnType.kind !== SkittlesTypeKind.Void) {
    return [{ kind: "return", value: callExpr }];
  } else {
    return [{ kind: "expression", expression: callExpr }];
  }
}

export function getDefaultValueForType(type: SkittlesType): Expression {
  switch (type.kind) {
    case SkittlesTypeKind.Uint256:
    case SkittlesTypeKind.Int256:
    case SkittlesTypeKind.Bytes32:
      return { kind: "number-literal", value: "0" };
    case SkittlesTypeKind.Bool:
      return { kind: "boolean-literal", value: false };
    case SkittlesTypeKind.String:
    case SkittlesTypeKind.Bytes:
      return { kind: "string-literal", value: "" };
    case SkittlesTypeKind.Address:
      return {
        kind: "call",
        callee: { kind: "identifier", name: "address" },
        args: [{ kind: "number-literal", value: "0" }],
      };
    default:
      throw new Error(
        `Cannot generate default value for unsupported type: ${type.kind}`
      );
  }
}

export function parseGetAccessor(
  node: ts.GetAccessorDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name =
    node.name && ts.isIdentifier(node.name) ? node.name.text : "unknown";

  validateReservedName("Accessor name", name);

  const parameters: SkittlesParameter[] = [];
  // Clone varTypes to create a per-function scope that won't leak locals to other methods
  const localVarTypes = new Map(varTypes);
  setupStringTracking(parameters, localVarTypes);
  const returnType: SkittlesType | null = node.type
    ? parseType(node.type)
    : null;
  const visibility = getVisibility(node.modifiers);
  const rawBody = node.body
    ? parseBlock(node.body, localVarTypes, eventNames)
    : [];
  const body = rewriteInterfacePropertyGetters(
    rawBody,
    localVarTypes,
    parameters
  );
  const stateMutability = inferStateMutability(body, localVarTypes, parameters);

  const isOverride = hasModifier(node.modifiers, ts.SyntaxKind.OverrideKeyword);
  const isVirtual = !isOverride;

  return {
    name,
    parameters,
    returnType,
    visibility,
    stateMutability,
    isVirtual,
    isOverride,
    body,
    sourceLine: getSourceLine(node),
  };
}

export function parseSetAccessor(
  node: ts.SetAccessorDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name =
    node.name && ts.isIdentifier(node.name) ? node.name.text : "unknown";

  validateReservedName("Accessor name", name);

  const parameters = node.parameters.map(parseParameter);
  // Clone varTypes to create a per-function scope that won't leak locals to other methods
  const localVarTypes = new Map(varTypes);
  setupStringTracking(parameters, localVarTypes);
  const returnType: SkittlesType | null = null; // setters don't return
  const visibility = getVisibility(node.modifiers);
  const rawBody = node.body
    ? parseBlock(node.body, localVarTypes, eventNames)
    : [];
  const body = rewriteInterfacePropertyGetters(
    rawBody,
    localVarTypes,
    parameters
  );
  const stateMutability = inferStateMutability(body, localVarTypes, parameters);

  const isOverride = hasModifier(node.modifiers, ts.SyntaxKind.OverrideKeyword);
  const isVirtual = !isOverride;

  return {
    name,
    parameters,
    returnType,
    visibility,
    stateMutability,
    isVirtual,
    isOverride,
    body,
    sourceLine: getSourceLine(node),
  };
}

export function parseArrowProperty(
  node: ts.PropertyDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name =
    node.name && ts.isIdentifier(node.name) ? node.name.text : "unknown";

  validateReservedName("Property name", name);

  const arrow = node.initializer as ts.ArrowFunction;
  const parameters = arrow.parameters.map(parseParameter);
  // Clone varTypes to create a per-function scope that won't leak locals to other methods
  const localVarTypes = new Map(varTypes);
  setupStringTracking(parameters, localVarTypes);

  const returnType: SkittlesType | null = arrow.type
    ? parseType(arrow.type)
    : null;

  const visibility = getVisibility(node.modifiers);

  let rawBody: Statement[] = [];
  if (arrow.body) {
    if (ts.isBlock(arrow.body)) {
      rawBody = parseBlock(arrow.body, localVarTypes, eventNames);
    } else {
      // Expression body: `() => expr` treated as `() => { return expr; }`
      rawBody = [
        { kind: "return" as const, value: parseExpression(arrow.body) },
      ];
    }
  }

  const body = rewriteInterfacePropertyGetters(
    rawBody,
    localVarTypes,
    parameters
  );
  const stateMutability = inferStateMutability(body, localVarTypes, parameters);
  const isOverride = hasModifier(node.modifiers, ts.SyntaxKind.OverrideKeyword);
  const isVirtual = !isOverride;

  return {
    name,
    parameters,
    returnType,
    visibility,
    stateMutability,
    isVirtual,
    isOverride,
    body,
    sourceLine: getSourceLine(node),
  };
}

export function parseConstructorDecl(
  node: ts.ConstructorDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesConstructor {
  const parameters = node.parameters.map(parseParameter);
  // Clone varTypes to create a per-function scope that won't leak locals to other methods
  const localVarTypes = new Map(varTypes);
  setupStringTracking(parameters, localVarTypes);
  const rawBody = node.body
    ? parseBlock(node.body, localVarTypes, eventNames)
    : [];
  const body = rewriteInterfacePropertyGetters(
    rawBody,
    localVarTypes,
    parameters
  );
  return { parameters, body, sourceLine: getSourceLine(node) };
}

export function parseParameter(
  node: ts.ParameterDeclaration
): SkittlesParameter {
  const name = ts.isIdentifier(node.name) ? node.name.text : "unknown";
  validateReservedName("Parameter name", name);
  const type: SkittlesType = node.type
    ? parseType(node.type)
    : { kind: SkittlesTypeKind.Uint256 };
  const param: SkittlesParameter = { name, type };
  if (node.initializer) {
    param.defaultValue = parseExpression(node.initializer);
  }
  return param;
}

// ============================================================
// Type parsing
// ============================================================
