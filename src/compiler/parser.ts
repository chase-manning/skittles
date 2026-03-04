import ts from "typescript";
import type {
  SkittlesContract,
  SkittlesVariable,
  SkittlesFunction,
  SkittlesConstructor,
  SkittlesEvent,
  SkittlesParameter,
  SkittlesType,
  SkittlesTypeKind,
  SkittlesContractInterface,
  SkittlesInterfaceFunction,
  Visibility,
  StateMutability,
  Statement,
  Expression,
  EmitStatement,
  ConsoleLogStatement,
  SwitchCase,
} from "../types/index.ts";

// Module-level registries, populated during parse()
let _knownStructs: Map<string, SkittlesParameter[]> = new Map();
let _knownContractInterfaces: Set<string> = new Set();
let _knownContractInterfaceMap: Map<string, SkittlesContractInterface> = new Map();
let _knownEnums: Map<string, string[]> = new Map();
let _knownCustomErrors: Set<string> = new Set();
let _fileConstants: Map<string, Expression> = new Map();
let _currentSourceFile: ts.SourceFile | null = null;

// String type tracking for string.length and string comparison transforms
let _currentVarTypes: Map<string, SkittlesType> = new Map();
let _currentStringNames: Set<string> = new Set();
let _currentEventNames: Set<string> = new Set();

// Array method support: generated helper functions and tracking
let _generatedArrayFunctions: SkittlesFunction[] = [];
let _arrayMethodCounter = 0;
let _neededArrayHelpers = new Set<string>();

// Function parameter type tracking (for spread operator type resolution)
let _currentParamTypes: Map<string, SkittlesType> = new Map();

function getSourceLine(node: ts.Node): number | undefined {
  if (!_currentSourceFile) return undefined;
  return _currentSourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1; // 1-based
}

function setupStringTracking(parameters: SkittlesParameter[], varTypes: Map<string, SkittlesType>) {
  _currentVarTypes = varTypes;
  _currentStringNames = new Set();
  _currentParamTypes = new Map();
  for (const param of parameters) {
    if (param.type.kind === ("string" as SkittlesTypeKind)) {
      _currentStringNames.add(param.name);
    }
    _currentParamTypes.set(param.name, param.type);
  }
}

function isStringExpr(expr: Expression): boolean {
  if (expr.kind === "string-literal") return true;
  if (expr.kind === "identifier" && _currentStringNames.has(expr.name)) return true;
  if (
    expr.kind === "property-access" &&
    expr.object.kind === "identifier" &&
    expr.object.name === "this"
  ) {
    const type = _currentVarTypes.get(expr.property);
    return type?.kind === ("string" as SkittlesTypeKind);
  }
  if (
    expr.kind === "call" &&
    expr.callee.kind === "property-access" &&
    expr.callee.object.kind === "identifier" &&
    expr.callee.object.name === "string" &&
    expr.callee.property === "concat"
  ) {
    return true;
  }
  if (
    expr.kind === "call" &&
    expr.callee.kind === "identifier" &&
    STRING_RETURNING_HELPERS.has(expr.callee.name)
  ) {
    return true;
  }
  return false;
}

const STRING_RETURNING_HELPERS = new Set([
  "_charAt", "_substring", "_toLowerCase", "_toUpperCase", "_trim",
]);

const STRING_METHODS: Record<string, { helper: string; minArgs: number; maxArgs: number }> = {
  charAt: { helper: "_charAt", minArgs: 0, maxArgs: 1 },
  substring: { helper: "_substring", minArgs: 1, maxArgs: 2 },
  toLowerCase: { helper: "_toLowerCase", minArgs: 0, maxArgs: 0 },
  toUpperCase: { helper: "_toUpperCase", minArgs: 0, maxArgs: 0 },
  startsWith: { helper: "_startsWith", minArgs: 1, maxArgs: 1 },
  endsWith: { helper: "_endsWith", minArgs: 1, maxArgs: 1 },
  trim: { helper: "_trim", minArgs: 0, maxArgs: 0 },
  split: { helper: "_split", minArgs: 1, maxArgs: 1 },
};

const KNOWN_ARRAY_METHODS = new Set([
  "includes", "indexOf", "lastIndexOf", "at",
  "slice", "concat", "filter", "map", "forEach", "some", "every",
  "find", "findIndex", "reduce", "remove", "reverse", "splice",
]);

function describeExpectedArgs(method: string, argCount?: number): string {
  const allArgs: Record<string, string[]> = {
    charAt: ["index"],
    substring: ["start", "end"],
    toLowerCase: [],
    toUpperCase: [],
    startsWith: ["prefix"],
    endsWith: ["suffix"],
    trim: [],
    split: ["delimiter"],
  };
  const args = allArgs[method] ?? [];
  if (argCount !== undefined) return args.slice(0, argCount).join(", ");
  return args.join(", ");
}

// ============================================================
// Main entry
// ============================================================

/**
 * Pre-scan a source file to collect type aliases (structs), interfaces
 * (contract interfaces), and enums without parsing any classes.
 * Used by the compiler to resolve cross-file type references.
 */
export function collectTypes(source: string, filePath: string): {
  structs: Map<string, SkittlesParameter[]>;
  enums: Map<string, string[]>;
  contractInterfaces: Map<string, SkittlesContractInterface>;
} {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );

  const structs: Map<string, SkittlesParameter[]> = new Map();
  const enums: Map<string, string[]> = new Map();
  const contractInterfaces: Map<string, SkittlesContractInterface> = new Map();

  // Temporarily set module registries so parseType can resolve references
  const prevStructs = _knownStructs;
  const prevEnums = _knownEnums;
  const prevInterfaces = _knownContractInterfaces;
  const prevInterfaceMap = _knownContractInterfaceMap;
  _knownStructs = structs;
  _knownEnums = new Map();
  _knownContractInterfaces = new Set();
  _knownContractInterfaceMap = new Map();

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name && ts.isTypeLiteralNode(node.type)) {
      const fields = parseTypeLiteralFields(node.type);
      structs.set(node.name.text, fields);
    }
    if (ts.isInterfaceDeclaration(node) && node.name) {
      const iface = parseInterfaceAsContractInterface(node);
      contractInterfaces.set(node.name.text, iface);
      _knownContractInterfaces.add(node.name.text);
    }
    if (ts.isEnumDeclaration(node) && node.name) {
      const members = node.members.map((m) =>
        ts.isIdentifier(m.name) ? m.name.text : "Unknown"
      );
      enums.set(node.name.text, members);
    }
  });

  _knownStructs = prevStructs;
  _knownEnums = prevEnums;
  _knownContractInterfaces = prevInterfaces;
  _knownContractInterfaceMap = prevInterfaceMap;

  return { structs, enums, contractInterfaces };
}

export interface ExternalTypes {
  structs?: Map<string, SkittlesParameter[]>;
  enums?: Map<string, string[]>;
  contractInterfaces?: Map<string, SkittlesContractInterface>;
}

export interface ExternalFunctions {
  functions?: SkittlesFunction[];
  constants?: Map<string, Expression>;
}

export function parse(
  source: string,
  filePath: string,
  externalTypes?: ExternalTypes,
  externalFunctions?: ExternalFunctions
): SkittlesContract[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );

  _currentSourceFile = sourceFile;
  _arrayMethodCounter = 0;

  const structs: Map<string, SkittlesParameter[]> = new Map();
  const enums: Map<string, string[]> = new Map();
  const contractInterfaces: Map<string, SkittlesContractInterface> = new Map();
  const contracts: SkittlesContract[] = [];

  // Seed with externally resolved types (from other files)
  if (externalTypes?.structs) {
    for (const [name, fields] of externalTypes.structs) {
      structs.set(name, fields);
    }
  }
  if (externalTypes?.enums) {
    for (const [name, members] of externalTypes.enums) {
      enums.set(name, members);
    }
  }
  if (externalTypes?.contractInterfaces) {
    for (const [name, iface] of externalTypes.contractInterfaces) {
      contractInterfaces.set(name, iface);
    }
  }

  // First pass: collect structs and enums so they are available when parsing interfaces
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name && ts.isTypeLiteralNode(node.type)) {
      const fields = parseTypeLiteralFields(node.type);
      structs.set(node.name.text, fields);
    }
    if (ts.isEnumDeclaration(node) && node.name) {
      const members = node.members.map((m) =>
        ts.isIdentifier(m.name) ? m.name.text : "Unknown"
      );
      enums.set(node.name.text, members);
    }
  });

  _knownStructs = structs;
  _knownEnums = new Map(enums);

  // Second pass: parse interfaces (may reference struct/enum types collected above)
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name) {
      const iface = parseInterfaceAsContractInterface(node);
      contractInterfaces.set(node.name.text, iface);
    }
  });

  const customErrors: Map<string, SkittlesParameter[]> = new Map();

  _knownContractInterfaces = new Set(contractInterfaces.keys());
  _knownContractInterfaceMap = new Map(contractInterfaces);
  _knownCustomErrors = new Set();
  _fileConstants = new Map();

  // Collect file level constants (const declarations outside classes)
  const fileConstants: Map<string, Expression> = new Map();
  if (externalFunctions?.constants) {
    for (const [name, expr] of externalFunctions.constants) {
      fileConstants.set(name, expr);
    }
  }

  // Collect file level standalone functions (outside classes)
  const fileFunctions: SkittlesFunction[] = [];
  if (externalFunctions?.functions) {
    fileFunctions.push(...externalFunctions.functions);
  }

  // Empty varTypes for file level parsing (no state variables)
  const emptyVarTypes = new Map<string, SkittlesType>();
  const emptyEventNames = new Set<string>();

  // First: collect file level functions and constants
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      fileFunctions.push(parseStandaloneFunction(node, emptyVarTypes, emptyEventNames));
    }

    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          if (ts.isArrowFunction(decl.initializer)) {
            fileFunctions.push(parseStandaloneArrowFunction(decl, emptyVarTypes, emptyEventNames));
          } else {
            fileConstants.set(decl.name.text, parseExpression(decl.initializer));
          }
        }
      }
    }
  });

  // Set module level constant registry so parseExpression can inline them
  _fileConstants = fileConstants;

  // Second: parse classes (with access to file constants and functions)
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isClassDeclaration(node) && node.name) {
      if (extendsError(node)) {
        const params = parseErrorClass(node);
        customErrors.set(node.name.text, params);
        _knownCustomErrors.add(node.name.text);
      } else {
        contracts.push(parseClass(node, filePath, structs, enums, contractInterfaces, customErrors, fileFunctions, fileConstants));
      }
    }
  });

  // Post-process: infer overrides for abstract method implementations
  const abstractMethodsByContract = new Map<string, Set<string>>();
  for (const contract of contracts) {
    if (contract.isAbstract) {
      const abstractMethods = new Set<string>();
      for (const fn of contract.functions) {
        if (fn.isAbstract) {
          abstractMethods.add(fn.name);
        }
      }
      if (abstractMethods.size > 0) {
        abstractMethodsByContract.set(contract.name, abstractMethods);
      }
    }
  }
  const contractByName = new Map(contracts.map((c) => [c.name, c]));
  for (const contract of contracts) {
    for (const parentName of contract.inherits) {
      const abstractMethods = abstractMethodsByContract.get(parentName);
      if (!abstractMethods) continue;
      for (const fn of contract.functions) {
        if (abstractMethods.has(fn.name) && !fn.isOverride) {
          fn.isOverride = true;
          fn.isVirtual = false;
        }
      }
    }
  }

  // Build transitive descendant map so multi-level inheritance is handled
  // (e.g. abstract A → abstract B extends A → class C extends B)
  const descendantsOf = new Map<string, Set<string>>();
  for (const contract of contracts) {
    for (const parentName of contract.inherits) {
      if (!descendantsOf.has(parentName)) descendantsOf.set(parentName, new Set());
      descendantsOf.get(parentName)!.add(contract.name);
    }
  }
  function getAllDescendants(name: string): Set<string> {
    const result = new Set<string>();
    const queue = [name];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = descendantsOf.get(current);
      if (!children) continue;
      for (const child of children) {
        if (!result.has(child)) {
          result.add(child);
          queue.push(child);
        }
      }
    }
    return result;
  }

  // Propagate state mutability from concrete implementations to abstract declarations
  for (const [parentName] of abstractMethodsByContract) {
    const parent = contractByName.get(parentName);
    if (!parent) continue;
    const descendants = getAllDescendants(parentName);
    for (const abstractFn of parent.functions) {
      if (!abstractFn.isAbstract) continue;
      let inferredRank: number | undefined;
      for (const descName of descendants) {
        const desc = contractByName.get(descName);
        if (!desc) continue;
        const concreteFn = desc.functions.find((f) => f.name === abstractFn.name && !f.isAbstract);
        if (!concreteFn) continue;
        const rank = MUTABILITY_RANK[concreteFn.stateMutability];
        if (inferredRank === undefined || rank > inferredRank) {
          inferredRank = rank;
        }
      }
      if (inferredRank !== undefined && inferredRank < MUTABILITY_RANK[abstractFn.stateMutability]) {
        const rankToMut = ["pure", "view", "nonpayable", "payable"] as const;
        abstractFn.stateMutability = rankToMut[inferredRank];
      }
    }
  }

  // Post-process: propagate state mutability across function calls.
  // When a function calls this.someMethod(), and someMethod is known to
  // be nonpayable/payable (state-modifying), the caller must be at least
  // as permissive. This is critical for inheritance where child functions
  // call parent internal functions like _mint/_burn.
  propagateMutability(contracts);

  return contracts;
}

/**
 * Pre-scan a source file to collect file level functions and constants
 * without parsing classes. Used by the compiler for cross file resolution.
 */
export function collectFunctions(source: string, filePath: string): {
  functions: SkittlesFunction[];
  constants: Map<string, Expression>;
} {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );

  const functions: SkittlesFunction[] = [];
  const constants: Map<string, Expression> = new Map();
  const emptyVarTypes = new Map<string, SkittlesType>();
  const emptyEventNames = new Set<string>();

  // Need to set up struct/enum/interface registries for type parsing
  const prevStructs = _knownStructs;
  const prevEnums = _knownEnums;
  const prevInterfaces = _knownContractInterfaces;
  const prevInterfaceMap = _knownContractInterfaceMap;
  _knownStructs = new Map();
  _knownEnums = new Map();
  _knownContractInterfaces = new Set();
  _knownContractInterfaceMap = new Map();

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      functions.push(parseStandaloneFunction(node, emptyVarTypes, emptyEventNames));
    }

    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          if (ts.isArrowFunction(decl.initializer)) {
            functions.push(parseStandaloneArrowFunction(decl, emptyVarTypes, emptyEventNames));
          } else {
            constants.set(decl.name.text, parseExpression(decl.initializer));
          }
        }
      }
    }
  });

  _knownStructs = prevStructs;
  _knownEnums = prevEnums;
  _knownContractInterfaces = prevInterfaces;
  _knownContractInterfaceMap = prevInterfaceMap;

  return { functions, constants };
}

/**
 * Pre-scan a source file to collect the names of all contract classes
 * (top-level class declarations that do not extend Error).
 * Used by the compiler to track which file defines each contract.
 */
export function collectClassNames(source: string, filePath: string): string[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );

  const names: string[] = [];
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isClassDeclaration(node) && node.name && !extendsError(node)) {
      names.push(node.name.text);
    }
  });
  return names;
}

function parseArrayDestructuring(
  pattern: ts.ArrayBindingPattern,
  initializer: ts.Expression,
  varTypes: Map<string, SkittlesType>
): Statement[] {
  const statements: Statement[] = [];

  if (ts.isArrayLiteralExpression(initializer)) {
    // Direct array literal: const [a, b, c] = [7, 8, 9]
    for (let i = 0; i < pattern.elements.length; i++) {
      const elem = pattern.elements[i];
      if (ts.isBindingElement(elem) && ts.isIdentifier(elem.name)) {
        const name = elem.name.text;
        const init = i < initializer.elements.length
          ? parseExpression(initializer.elements[i])
          : undefined;
        const type = init ? inferType(init, varTypes) : undefined;
        statements.push({ kind: "variable-declaration" as const, name, type, initializer: init });
      }
    }
  } else if (ts.isConditionalExpression(initializer)) {
    // Conditional destructuring: let [a, b] = cond ? [x, y] : [y, x]
    const condition = parseExpression(initializer.condition);

    const trueExprs: Expression[] = ts.isArrayLiteralExpression(initializer.whenTrue)
      ? initializer.whenTrue.elements.map(parseExpression)
      : [];
    const falseExprs: Expression[] = ts.isArrayLiteralExpression(initializer.whenFalse)
      ? initializer.whenFalse.elements.map(parseExpression)
      : [];

    for (let i = 0; i < pattern.elements.length; i++) {
      const elem = pattern.elements[i];
      if (ts.isBindingElement(elem) && ts.isIdentifier(elem.name)) {
        const name = elem.name.text;
        const trueVal = i < trueExprs.length ? trueExprs[i] : { kind: "number-literal" as const, value: "0" };
        const falseVal = i < falseExprs.length ? falseExprs[i] : { kind: "number-literal" as const, value: "0" };
        const init: Expression = { kind: "conditional", condition, whenTrue: trueVal, whenFalse: falseVal };
        const type = inferType(trueVal, varTypes);
        statements.push({ kind: "variable-declaration" as const, name, type, initializer: init });
      }
    }
  } else {
    // Fallback: parse as expression and hope for the best
    for (let i = 0; i < pattern.elements.length; i++) {
      const elem = pattern.elements[i];
      if (ts.isBindingElement(elem) && ts.isIdentifier(elem.name)) {
        statements.push({
          kind: "variable-declaration" as const,
          name: elem.name.text,
          type: undefined,
          initializer: undefined,
        });
      }
    }
  }

  return statements;
}

function parseObjectDestructuring(
  pattern: ts.ObjectBindingPattern,
  initializer: ts.Expression,
  varTypes: Map<string, SkittlesType>,
  decl: ts.VariableDeclaration
): Statement[] {
  const statements: Statement[] = [];

  if (ts.isObjectLiteralExpression(initializer)) {
    // Direct object literal: const { a, b } = { a: 1, b: 2 }
    const propMap = new Map<string, ts.Expression>();
    for (const prop of initializer.properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
        propMap.set(prop.name.text, prop.initializer);
      }
    }

    for (const elem of pattern.elements) {
      if (ts.isBindingElement(elem) && ts.isIdentifier(elem.name)) {
        const name = elem.name.text;
        const propName =
          elem.propertyName && ts.isIdentifier(elem.propertyName)
            ? elem.propertyName.text
            : name;
        const init = propMap.has(propName)
          ? parseExpression(propMap.get(propName)!)
          : undefined;
        const type = init ? inferType(init, varTypes) : undefined;
        statements.push({
          kind: "variable-declaration" as const,
          name,
          type,
          initializer: init,
        });
      }
    }
    return statements;
  }

  // Non-literal initializer: const { amount, timestamp } = this.getStakeInfo(account)
  // Try to resolve struct type for a temp variable approach
  let structType: SkittlesType | undefined;

  // Check explicit type annotation
  if (decl.type) {
    structType = parseType(decl.type);
  }

  // If no explicit type, try to find it from a this.method() call
  if (!structType && ts.isCallExpression(initializer)) {
    const callee = initializer.expression;
    if (
      ts.isPropertyAccessExpression(callee) &&
      callee.expression.kind === ts.SyntaxKind.ThisKeyword
    ) {
      const methodName = callee.name.text;
      const cls = findEnclosingClass(decl);
      if (cls) {
        const retTypeNode = findMethodReturnType(cls, methodName);
        if (retTypeNode) {
          structType = parseType(retTypeNode);
        }
      }
    }
  }

  const initExpr = parseExpression(initializer);

  if (structType?.kind === ("struct" as SkittlesTypeKind) && structType.structName) {
    // Temp variable + field accesses
    const tempName = `_${structType.structName.charAt(0).toLowerCase()}${structType.structName.slice(1)}`;
    statements.push({
      kind: "variable-declaration" as const,
      name: tempName,
      type: structType,
      initializer: initExpr,
    });

    const fieldMap = new Map<string, SkittlesType>();
    if (structType.structFields) {
      for (const f of structType.structFields) {
        fieldMap.set(f.name, f.type);
      }
    }

    for (const elem of pattern.elements) {
      if (ts.isBindingElement(elem) && ts.isIdentifier(elem.name)) {
        const name = elem.name.text;
        const propName =
          elem.propertyName && ts.isIdentifier(elem.propertyName)
            ? elem.propertyName.text
            : name;
        statements.push({
          kind: "variable-declaration" as const,
          name,
          type: fieldMap.get(propName),
          initializer: {
            kind: "property-access" as const,
            object: { kind: "identifier" as const, name: tempName },
            property: propName,
          },
        });
      }
    }
  } else {
    // Fallback: property-access expressions directly on the initializer
    for (const elem of pattern.elements) {
      if (ts.isBindingElement(elem) && ts.isIdentifier(elem.name)) {
        const name = elem.name.text;
        const propName =
          elem.propertyName && ts.isIdentifier(elem.propertyName)
            ? elem.propertyName.text
            : name;
        statements.push({
          kind: "variable-declaration" as const,
          name,
          type: undefined,
          initializer: {
            kind: "property-access" as const,
            object: initExpr,
            property: propName,
          },
        });
      }
    }
  }

  return statements;
}

function findEnclosingClass(node: ts.Node): ts.ClassDeclaration | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isClassDeclaration(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function findMethodReturnType(
  cls: ts.ClassDeclaration,
  methodName: string
): ts.TypeNode | undefined {
  for (const member of cls.members) {
    if (
      ts.isMethodDeclaration(member) &&
      member.name &&
      ts.isIdentifier(member.name) &&
      member.name.text === methodName
    ) {
      return member.type;
    }
  }
  return undefined;
}

function parseStandaloneFunction(
  node: ts.FunctionDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name = node.name ? node.name.text : "unknown";
  const parameters = node.parameters.map(parseParameter);
  setupStringTracking(parameters, varTypes);
  const returnType: SkittlesType | null = node.type ? parseType(node.type) : null;
  const body = node.body ? parseBlock(node.body, varTypes, eventNames) : [];
  const stateMutability = inferStateMutability(body);

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

function parseStandaloneArrowFunction(
  decl: ts.VariableDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name = ts.isIdentifier(decl.name) ? decl.name.text : "unknown";
  const arrow = decl.initializer as ts.ArrowFunction;
  const parameters = arrow.parameters.map(parseParameter);
  setupStringTracking(parameters, varTypes);
  const returnType: SkittlesType | null = arrow.type ? parseType(arrow.type) : null;

  let body: Statement[] = [];
  if (arrow.body) {
    if (ts.isBlock(arrow.body)) {
      body = parseBlock(arrow.body, varTypes, eventNames);
    } else {
      body = [{ kind: "return" as const, value: parseExpression(arrow.body) }];
    }
  }

  const stateMutability = inferStateMutability(body);

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

function extendsError(node: ts.ClassDeclaration): boolean {
  if (!node.heritageClauses) return false;
  return node.heritageClauses.some(
    (clause) =>
      clause.token === ts.SyntaxKind.ExtendsKeyword &&
      clause.types.some(
        (t) => ts.isIdentifier(t.expression) && t.expression.text === "Error"
      )
  );
}

function parseErrorClass(node: ts.ClassDeclaration): SkittlesParameter[] {
  for (const member of node.members) {
    if (ts.isConstructorDeclaration(member)) {
      return member.parameters.map(parseParameter);
    }
  }
  return [];
}

function parseTypeLiteralFields(node: ts.TypeLiteralNode): SkittlesParameter[] {
  const fields: SkittlesParameter[] = [];
  for (const member of node.members) {
    if (
      ts.isPropertySignature(member) &&
      member.name &&
      ts.isIdentifier(member.name)
    ) {
      const name = member.name.text;
      const type: SkittlesType = member.type
        ? parseType(member.type)
        : { kind: "uint256" as SkittlesTypeKind };
      fields.push({ name, type });
    }
  }
  return fields;
}

function parseInterfaceAsContractInterface(
  node: ts.InterfaceDeclaration
): SkittlesContractInterface {
  const name = node.name.text;
  const functions: SkittlesInterfaceFunction[] = [];

  for (const member of node.members) {
    if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
      const propName = member.name.text;
      const returnType: SkittlesType = member.type
        ? parseType(member.type)
        : { kind: "uint256" as SkittlesTypeKind };
      functions.push({ name: propName, parameters: [], returnType, stateMutability: "view" });
    }

    if (ts.isMethodSignature(member) && member.name && ts.isIdentifier(member.name)) {
      const methodName = member.name.text;
      const parameters = member.parameters.map(parseParameter);
      const returnType: SkittlesType | null = member.type ? parseType(member.type) : null;
      functions.push({ name: methodName, parameters, returnType });
    }
  }

  return { name, functions };
}

// ============================================================
// Class level parsing
// ============================================================

function parseClass(
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
  _generatedArrayFunctions = [];
  _neededArrayHelpers = new Set();

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

  // First pass: collect state variables, events, and inline errors
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
          _knownCustomErrors.add(error.name);
          continue;
        }
        variables.push(parseProperty(member));
      }
    }
  }

  const varTypes = new Map<string, SkittlesType>();
  for (const v of variables) {
    varTypes.set(v.name, v.type);
  }

  const eventNames = new Set(events.map((e) => e.name));
  _currentEventNames = eventNames;

  // Second pass: methods (instance and static), constructor, and arrow function properties
  // Group method declarations by static/instance + name to detect overloads
  const methodGroups = new Map<string, ts.MethodDeclaration[]>();
  const methodOrder: string[] = [];

  for (const member of node.members) {
    if (ts.isMethodDeclaration(member)) {
      const name = member.name && ts.isIdentifier(member.name) ? member.name.text : "unknown";
      const isStatic = hasModifier(member.modifiers, ts.SyntaxKind.StaticKeyword);
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
    const overloadSigs = decls.filter(d => !d.body && !hasModifier(d.modifiers, ts.SyntaxKind.AbstractKeyword));
    const impls = decls.filter(d => !!d.body);

    if (overloadSigs.length > 0) {
      if (impls.length !== 1) {
        throw new Error(
          `Method "${name}" has ${overloadSigs.length} overload signature(s) but ${impls.length} implementation(s); ` +
            "expected exactly one implementation for an overloaded method."
        );
      }
      // Overloaded method: resolve signatures with the single implementation body
      resolveOverloadedMethods(overloadSigs, impls[0], varTypes, eventNames, functions);
    } else {
      // Normal methods (no overloading)
      for (const decl of decls) {
        const isStatic = hasModifier(decl.modifiers, ts.SyntaxKind.StaticKeyword);
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
  for (const fn of _generatedArrayFunctions) {
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
      if (expr.kind === "call" && expr.callee.kind === "identifier" && fileFnNames.has(expr.callee.name)) {
        usedFileFnNames.add(expr.callee.name);
      }
    });
  };
  for (const f of functions) collectFnCalls(f.body);
  if (ctor) collectFnCalls(ctor.body);
  for (const v of variables) {
    if (v.initialValue) {
      walkStatements([{ kind: "expression", expression: v.initialValue }], (expr) => {
        if (expr.kind === "call" && expr.callee.kind === "identifier" && fileFnNames.has(expr.callee.name)) {
          usedFileFnNames.add(expr.callee.name);
        }
      });
    }
  }
  // Transitively include file functions called by other used file functions
  let fnChanged = true;
  while (fnChanged) {
    fnChanged = false;
    for (const fn of fileFunctions) {
      if (!usedFileFnNames.has(fn.name)) continue;
      walkStatements(fn.body, (expr) => {
        if (expr.kind === "call" && expr.callee.kind === "identifier" && fileFnNames.has(expr.callee.name) && !usedFileFnNames.has(expr.callee.name)) {
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
          if (ts.isIdentifier(type.expression) && knownContractInterfaces.has(type.expression.text)) {
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
    if (type.kind === ("struct" as SkittlesTypeKind) && type.structName) usedStructNames.add(type.structName);
    if (type.kind === ("enum" as SkittlesTypeKind) && type.structName) usedEnumNames.add(type.structName);
    if (type.keyType) collectTypeRef(type.keyType);
    if (type.valueType) collectTypeRef(type.valueType);
    if (type.tupleTypes) for (const t of type.tupleTypes) collectTypeRef(t);
    // Include struct field types transitively
    if (type.structFields) for (const f of type.structFields) collectTypeRef(f.type);
  };
  const collectBodyTypeRefs = (stmts: Statement[]) => {
    walkStatements(stmts, (expr) => {
      // Enum member access: Color.Red
      if (expr.kind === "property-access" && expr.object.kind === "identifier" && knownEnums.has(expr.object.name)) {
        usedEnumNames.add(expr.object.name);
      }
      // Type arguments on call expressions (e.g. contract interface casts)
      if (expr.kind === "call" && expr.typeArgs) {
        for (const t of expr.typeArgs) collectTypeRef(t);
      }
    }, (stmt) => {
      if (stmt.kind === "variable-declaration" && stmt.type) collectTypeRef(stmt.type);
      if (stmt.kind === "try-catch" && stmt.returnType) collectTypeRef(stmt.returnType);
    });
  };
  for (const v of variables) {
    collectTypeRef(v.type);
    if (v.initialValue) collectBodyTypeRefs([{ kind: "expression", expression: v.initialValue }]);
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
        if (usedStructNames.size + usedEnumNames.size > sizeBefore) typeChanged = true;
      }
    }
  }

  const contractStructs: { name: string; fields: SkittlesParameter[] }[] = [];
  for (const [sName, fields] of knownStructs) {
    if (usedStructNames.has(sName)) contractStructs.push({ name: sName, fields });
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
    for (const p of f.parameters) collectContractInterfaceTypeRefs(p.type, usedIfaceNames);
    if (f.returnType) collectContractInterfaceTypeRefs(f.returnType, usedIfaceNames);
    collectBodyContractInterfaceRefs(f.body, usedIfaceNames);
  }
  if (ctor) {
    for (const p of ctor.parameters) collectContractInterfaceTypeRefs(p.type, usedIfaceNames);
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
          const varImpl = variables.find((v) => v.name === ifn.name && v.visibility === "public");
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
      if (v.visibility === "public" && interfaceFnNames.has(v.name) && !v.constant && !v.immutable) {
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
    const externalCalls = collectExternalInterfaceCalls(fn.body, varTypes, fnVarTypes);
    if (externalCalls.length === 0) continue;

    let allExternalAreViewLike = true;
    for (const { ifaceName, methodName } of externalCalls) {
      const iface = contractIfaceList.find(i => i.name === ifaceName);
      if (!iface) {
        allExternalAreViewLike = false;
        break;
      }
      const ifaceMethod = iface.functions.find(f => f.name === methodName);
      if (
        !ifaceMethod ||
        (ifaceMethod.stateMutability !== "view" && ifaceMethod.stateMutability !== "pure")
      ) {
        allExternalAreViewLike = false;
        break;
      }
    }
    if (!allExternalAreViewLike) continue;

    // All external calls are to explicitly view/pure methods, so the wrapper
    // itself can safely be marked with the base mutability.
    const baseMut = inferStateMutability(fn.body, varTypes, fn.parameters, true);
    if (baseMut === "view" || baseMut === "pure") {
      fn.stateMutability = baseMut;
    }
  }

  const contractCustomErrors: { name: string; parameters: SkittlesParameter[] }[] = [];
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
    neededArrayHelpers: _neededArrayHelpers.size > 0 ? [..._neededArrayHelpers] : undefined,
  };
}

// ============================================================
// Event detection
// ============================================================

function tryParseEvent(
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
        : { kind: "uint256" as SkittlesTypeKind };
      parameters.push({ name: paramName, type: paramType, indexed });
    }
  }

  return { name, parameters, sourceLine: getSourceLine(node) };
}

// ============================================================
// Error detection (SkittlesError<{...}>)
// ============================================================

function tryParseError(
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
        : { kind: "uint256" as SkittlesTypeKind };
      parameters.push({ name: paramName, type: paramType });
    }
  }

  return { name, parameters };
}

function parseProperty(node: ts.PropertyDeclaration): SkittlesVariable {
  const name =
    node.name && ts.isIdentifier(node.name) ? node.name.text : "unknown";

  const type: SkittlesType = node.type
    ? parseType(node.type)
    : { kind: "uint256" as SkittlesTypeKind };

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

  return { name, type, visibility, immutable, constant, initialValue, sourceLine: getSourceLine(node) };
}

function parseMethod(
  node: ts.MethodDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name =
    node.name && ts.isIdentifier(node.name) ? node.name.text : "unknown";

  const parameters = node.parameters.map(parseParameter);
  setupStringTracking(parameters, varTypes);
  const returnType: SkittlesType | null = node.type
    ? parseType(node.type)
    : null;
  const visibility = getVisibility(node.modifiers);
  const isAbstractMethod = hasModifier(node.modifiers, ts.SyntaxKind.AbstractKeyword);
  const body = node.body ? parseBlock(node.body, varTypes, eventNames) : [];
  const stateMutability = isAbstractMethod ? inferAbstractStateMutability() : inferStateMutability(body, varTypes, parameters);

  const isOverride = hasModifier(node.modifiers, ts.SyntaxKind.OverrideKeyword);
  const isVirtual = !isOverride;

  return { name, parameters, returnType, visibility, stateMutability, isVirtual, isOverride, isAbstract: isAbstractMethod ? true : undefined, body, sourceLine: getSourceLine(node) };
}

function resolveOverloadedMethods(
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
  const paramCounts = sortedSigs.map(s => s.parameters.length);
  const uniqueCounts = new Set(paramCounts);
  if (uniqueCounts.size !== paramCounts.length) {
    const name = impl.name && ts.isIdentifier(impl.name) ? impl.name.text : "unknown";
    throw new Error(
      `Method "${name}" has multiple overload signatures with the same parameter count. ` +
        "Skittles only supports overloads distinguished by parameter count."
    );
  }

  const longestSig = sortedSigs[sortedSigs.length - 1];
  const longestParams = longestSig.parameters.map(parseParameter);

  // Validate that implementation has the same parameter count as the longest overload
  if (impl.parameters.length !== longestSig.parameters.length) {
    const name = impl.name && ts.isIdentifier(impl.name) ? impl.name.text : "unknown";
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
        implFn.parameters.length,
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

function buildOverloadForwardingBody(
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

  if (returnType && returnType.kind !== ("void" as SkittlesTypeKind)) {
    return [{ kind: "return", value: callExpr }];
  } else {
    return [{ kind: "expression", expression: callExpr }];
  }
}

function getDefaultValueForType(type: SkittlesType): Expression {
  switch (type.kind) {
    case "uint256" as SkittlesTypeKind:
    case "int256" as SkittlesTypeKind:
    case "bytes32" as SkittlesTypeKind:
      return { kind: "number-literal", value: "0" };
    case "bool" as SkittlesTypeKind:
      return { kind: "boolean-literal", value: false };
    case "string" as SkittlesTypeKind:
    case "bytes" as SkittlesTypeKind:
      return { kind: "string-literal", value: "" };
    case "address" as SkittlesTypeKind:
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

function parseGetAccessor(
  node: ts.GetAccessorDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name =
    node.name && ts.isIdentifier(node.name) ? node.name.text : "unknown";

  const parameters: SkittlesParameter[] = [];
  setupStringTracking(parameters, varTypes);
  const returnType: SkittlesType | null = node.type
    ? parseType(node.type)
    : null;
  const visibility = getVisibility(node.modifiers);
  const body = node.body ? parseBlock(node.body, varTypes, eventNames) : [];
  const stateMutability = inferStateMutability(body, varTypes, parameters);

  const isOverride = hasModifier(node.modifiers, ts.SyntaxKind.OverrideKeyword);
  const isVirtual = !isOverride;

  return { name, parameters, returnType, visibility, stateMutability, isVirtual, isOverride, body, sourceLine: getSourceLine(node) };
}

function parseSetAccessor(
  node: ts.SetAccessorDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name =
    node.name && ts.isIdentifier(node.name) ? node.name.text : "unknown";

  const parameters = node.parameters.map(parseParameter);
  setupStringTracking(parameters, varTypes);
  const returnType: SkittlesType | null = null; // setters don't return
  const visibility = getVisibility(node.modifiers);
  const body = node.body ? parseBlock(node.body, varTypes, eventNames) : [];
  const stateMutability = inferStateMutability(body, varTypes, parameters);

  const isOverride = hasModifier(node.modifiers, ts.SyntaxKind.OverrideKeyword);
  const isVirtual = !isOverride;

  return { name, parameters, returnType, visibility, stateMutability, isVirtual, isOverride, body, sourceLine: getSourceLine(node) };
}

function parseArrowProperty(
  node: ts.PropertyDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name =
    node.name && ts.isIdentifier(node.name) ? node.name.text : "unknown";

  const arrow = node.initializer as ts.ArrowFunction;
  const parameters = arrow.parameters.map(parseParameter);
  setupStringTracking(parameters, varTypes);

  const returnType: SkittlesType | null = arrow.type
    ? parseType(arrow.type)
    : null;

  const visibility = getVisibility(node.modifiers);

  let body: Statement[] = [];
  if (arrow.body) {
    if (ts.isBlock(arrow.body)) {
      body = parseBlock(arrow.body, varTypes, eventNames);
    } else {
      // Expression body: `() => expr` treated as `() => { return expr; }`
      body = [{ kind: "return" as const, value: parseExpression(arrow.body) }];
    }
  }

  const stateMutability = inferStateMutability(body, varTypes, parameters);
  const isOverride = hasModifier(node.modifiers, ts.SyntaxKind.OverrideKeyword);
  const isVirtual = !isOverride;

  return { name, parameters, returnType, visibility, stateMutability, isVirtual, isOverride, body, sourceLine: getSourceLine(node) };
}

function parseConstructorDecl(
  node: ts.ConstructorDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesConstructor {
  const parameters = node.parameters.map(parseParameter);
  setupStringTracking(parameters, varTypes);
  const body = node.body ? parseBlock(node.body, varTypes, eventNames) : [];
  return { parameters, body, sourceLine: getSourceLine(node) };
}

function parseParameter(node: ts.ParameterDeclaration): SkittlesParameter {
  const name = ts.isIdentifier(node.name) ? node.name.text : "unknown";
  const type: SkittlesType = node.type
    ? parseType(node.type)
    : { kind: "uint256" as SkittlesTypeKind };
  const param: SkittlesParameter = { name, type };
  if (node.initializer) {
    param.defaultValue = parseExpression(node.initializer);
  }
  return param;
}

// ============================================================
// Type parsing
// ============================================================

export function parseType(node: ts.TypeNode): SkittlesType {
  if (ts.isTypeReferenceNode(node)) {
    const name = ts.isIdentifier(node.typeName)
      ? node.typeName.text
      : "";

    if (
      (name === "Record" || name === "Map") &&
      node.typeArguments &&
      node.typeArguments.length === 2
    ) {
      return {
        kind: "mapping" as SkittlesTypeKind,
        keyType: parseType(node.typeArguments[0]),
        valueType: parseType(node.typeArguments[1]),
      };
    }

    if (
      name === "ReadonlyArray" &&
      node.typeArguments &&
      node.typeArguments.length === 1
    ) {
      return {
        kind: "array" as SkittlesTypeKind,
        valueType: parseType(node.typeArguments[0]),
      };
    }

    if (name === "address") return { kind: "address" as SkittlesTypeKind };
    if (name === "bytes") return { kind: "bytes" as SkittlesTypeKind };

    if (_knownStructs.has(name)) {
      return {
        kind: "struct" as SkittlesTypeKind,
        structName: name,
        structFields: _knownStructs.get(name),
      };
    }

    if (_knownContractInterfaces.has(name)) {
      return {
        kind: "contract-interface" as SkittlesTypeKind,
        structName: name,
      };
    }

    if (_knownEnums.has(name)) {
      return {
        kind: "enum" as SkittlesTypeKind,
        structName: name,
      };
    }

    throw new Error(`Unsupported type reference: "${name}". Skittles supports number, string, boolean, address, bytes, Record<K,V>, T[], type structs, interfaces, and enums.`);
  }

  if (ts.isArrayTypeNode(node)) {
    return {
      kind: "array" as SkittlesTypeKind,
      valueType: parseType(node.elementType),
    };
  }

  if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword) {
    return parseType(node.type);
  }

  if (ts.isTupleTypeNode(node)) {
    return {
      kind: "tuple" as SkittlesTypeKind,
      tupleTypes: node.elements.map((el) => {
        if (ts.isNamedTupleMember(el)) {
          return parseType(el.type);
        }
        return parseType(el as ts.TypeNode);
      }),
    };
  }

  switch (node.kind) {
    case ts.SyntaxKind.NumberKeyword:
      return { kind: "uint256" as SkittlesTypeKind };
    case ts.SyntaxKind.StringKeyword:
      return { kind: "string" as SkittlesTypeKind };
    case ts.SyntaxKind.BooleanKeyword:
      return { kind: "bool" as SkittlesTypeKind };
    case ts.SyntaxKind.VoidKeyword:
      return { kind: "void" as SkittlesTypeKind };
    default:
      throw new Error(`Unsupported type node kind: ${ts.SyntaxKind[node.kind]}. Skittles supports number, string, boolean, address, bytes, Record<K,V>, and T[].`);
  }
}

// ============================================================
// Expression parsing
// ============================================================

export function parseExpression(node: ts.Expression): Expression {
  if (ts.isNumericLiteral(node)) {
    return { kind: "number-literal", value: node.text };
  }

  if (ts.isStringLiteral(node)) {
    return { kind: "string-literal", value: node.text };
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return { kind: "boolean-literal", value: true };
  }

  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: "boolean-literal", value: false };
  }

  if (ts.isIdentifier(node)) {
    // Inline file level constants
    const constExpr = _fileConstants.get(node.text);
    if (constExpr) return constExpr;
    // `self` is a reserved identifier for address(this)
    if (node.text === "self") return { kind: "identifier", name: "self" };
    return { kind: "identifier", name: node.text };
  }

  if (node.kind === ts.SyntaxKind.ThisKeyword) {
    return { kind: "identifier", name: "this" };
  }

  if (node.kind === ts.SyntaxKind.SuperKeyword) {
    return { kind: "identifier", name: "super" };
  }

  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "number-literal", value: "0" };
  }

  // undefined → 0 (Solidity zero value)
  if (node.kind === ts.SyntaxKind.UndefinedKeyword ||
      (ts.isIdentifier(node) && node.text === "undefined")) {
    return { kind: "number-literal", value: "0" };
  }

  if (ts.isPropertyAccessExpression(node)) {
    const object = parseExpression(node.expression);
    const property = node.name.text;

    // string.length → bytes(str).length
    if (property === "length" && isStringExpr(object)) {
      return {
        kind: "property-access",
        object: {
          kind: "call",
          callee: { kind: "identifier", name: "bytes" },
          args: [object],
        },
        property: "length",
      };
    }

    return { kind: "property-access", object, property };
  }

  if (ts.isElementAccessExpression(node)) {
    return {
      kind: "element-access",
      object: parseExpression(node.expression),
      index: parseExpression(node.argumentExpression),
    };
  }

  if (ts.isBinaryExpression(node)) {
    const opKind = node.operatorToken.kind;

    // Comma operator: (a, b) → just use the right side (last value)
    if (opKind === ts.SyntaxKind.CommaToken) {
      return parseExpression(node.right);
    }

    // Desugar ?? to ternary: x ?? y → (x == defaultZero ? y : x)
    // Solidity has no null/undefined; all types have default zero values.
    if (opKind === ts.SyntaxKind.QuestionQuestionToken) {
      const leftForCondition = parseExpression(node.left);
      const leftForFallback = parseExpression(node.left);
      const right = parseExpression(node.right);
      const leftType = inferType(leftForCondition, _currentVarTypes);
      const zeroValue = defaultValueForType(leftType) ?? { kind: "number-literal" as const, value: "0" };
      return {
        kind: "conditional",
        condition: {
          kind: "binary",
          operator: "==",
          left: leftForCondition,
          right: zeroValue,
        },
        whenTrue: right,
        whenFalse: leftForFallback,
      };
    }

    // Desugar **= to x = x ** y (Solidity has no **= operator)
    if (opKind === ts.SyntaxKind.AsteriskAsteriskEqualsToken) {
      const target = parseExpression(node.left);
      return {
        kind: "assignment",
        operator: "=",
        target,
        value: {
          kind: "binary",
          operator: "**",
          left: target,
          right: parseExpression(node.right),
        },
      };
    }

    const operator = getBinaryOperator(opKind);

    if (isAssignmentOperator(opKind)) {
      return {
        kind: "assignment",
        operator,
        target: parseExpression(node.left),
        value: parseExpression(node.right),
      };
    }

    const left = parseExpression(node.left);
    const right = parseExpression(node.right);

    // String comparison: str === other → keccak256(str) == keccak256(other)
    if ((operator === "==" || operator === "!=") && (isStringExpr(left) || isStringExpr(right))) {
      return {
        kind: "binary",
        operator,
        left: { kind: "call", callee: { kind: "identifier", name: "keccak256" } as Expression, args: [left] },
        right: { kind: "call", callee: { kind: "identifier", name: "keccak256" } as Expression, args: [right] },
      };
    }

    return {
      kind: "binary",
      operator,
      left,
      right,
    };
  }

  if (ts.isPrefixUnaryExpression(node)) {
    return {
      kind: "unary",
      operator: getUnaryOperator(node.operator),
      operand: parseExpression(node.operand),
      prefix: true,
    };
  }

  if (ts.isPostfixUnaryExpression(node)) {
    return {
      kind: "unary",
      operator: getUnaryOperator(node.operator),
      operand: parseExpression(node.operand),
      prefix: false,
    };
  }

  if (ts.isCallExpression(node)) {
    // Map.get(key) → mapping[key]
    if (ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "get" &&
        node.arguments.length === 1 &&
        isMappingLikeReceiver(node.expression.expression)) {
      return {
        kind: "element-access" as const,
        object: parseExpression(node.expression.expression),
        index: parseExpression(node.arguments[0]),
      };
    }

    // Map.has(key) → mapping[key] != <default>
    if (ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "has" &&
        node.arguments.length === 1 &&
        isMappingLikeReceiver(node.expression.expression)) {
      const valueType = resolveMappingValueType(node.expression.expression);
      const defaultExpr = defaultValueForType(valueType);
      if (!defaultExpr) {
        throw new Error(
          "Map.has(key) is not supported for this mapping value type. " +
          "Please use an explicit comparison against the mapping's default value."
        );
      }
      return {
        kind: "binary" as const,
        operator: "!=",
        left: {
          kind: "element-access" as const,
          object: parseExpression(node.expression.expression),
          index: parseExpression(node.arguments[0]),
        },
        right: defaultExpr,
      };
    }

    // Array method calls on storage arrays
    if (ts.isPropertyAccessExpression(node.expression) &&
        isArrayLikeReceiver(node.expression.expression)) {
      const methodName = node.expression.name.text;
      const elementType = resolveArrayElementType(node.expression.expression);
      const receiverExpr = parseExpression(node.expression.expression);
      const typeSuffix = getArrayHelperSuffix(elementType);

      const NON_COMPARABLE_KINDS = new Set(["struct", "array", "tuple", "mapping"] as SkittlesTypeKind[]);
      const isNonComparable = elementType != null && NON_COMPARABLE_KINDS.has(elementType.kind);

      // includes(value) → _arrIncludes_T(arr, value)
      if (methodName === "includes" && node.arguments.length === 1) {
        if (isNonComparable) throw new Error(`Unsupported: .includes() on ${typeSuffix}[] arrays. Element type does not support equality in Solidity. Use .some() with a callback instead.`);
        _neededArrayHelpers.add(`includes_${typeSuffix}`);
        return {
          kind: "call" as const,
          callee: { kind: "identifier" as const, name: `_arrIncludes_${typeSuffix}` },
          args: [receiverExpr, parseExpression(node.arguments[0])],
        };
      }

      // indexOf(value) → _arrIndexOf_T(arr, value)
      if (methodName === "indexOf" && node.arguments.length === 1) {
        if (isNonComparable) throw new Error(`Unsupported: .indexOf() on ${typeSuffix}[] arrays. Element type does not support equality in Solidity. Use .findIndex() with a callback instead.`);
        _neededArrayHelpers.add(`indexOf_${typeSuffix}`);
        return {
          kind: "call" as const,
          callee: { kind: "identifier" as const, name: `_arrIndexOf_${typeSuffix}` },
          args: [receiverExpr, parseExpression(node.arguments[0])],
        };
      }

      // lastIndexOf(value) → _arrLastIndexOf_T(arr, value)
      if (methodName === "lastIndexOf" && node.arguments.length === 1) {
        if (isNonComparable) throw new Error(`Unsupported: .lastIndexOf() on ${typeSuffix}[] arrays. Element type does not support equality in Solidity.`);
        _neededArrayHelpers.add(`lastIndexOf_${typeSuffix}`);
        return {
          kind: "call" as const,
          callee: { kind: "identifier" as const, name: `_arrLastIndexOf_${typeSuffix}` },
          args: [receiverExpr, parseExpression(node.arguments[0])],
        };
      }

      // at(index) → arr[index] with negative index support
      if (methodName === "at" && node.arguments.length === 1) {
        const indexArg = node.arguments[0];
        if (ts.isPrefixUnaryExpression(indexArg) && indexArg.operator === ts.SyntaxKind.MinusToken) {
          if (ts.isNumericLiteral(indexArg.operand)) {
            if (Number(indexArg.operand.text) === 0) {
              return mkElem(receiverExpr, mkNum("0"));
            }
            return mkElem(receiverExpr, mkBin(mkProp(receiverExpr, "length"), "-", mkNum(indexArg.operand.text)));
          }
          throw new Error("Array .at() only supports negative numeric literals (e.g., .at(-1)). Non-literal negative indices would produce invalid uint256 values in Solidity.");
        }
        return mkElem(receiverExpr, parseExpression(indexArg));
      }

      // slice(start?, end?) → _arrSlice_T(arr, start, end)
      if (methodName === "slice") {
        if (node.arguments.length > 2) throw new Error("Array .slice() accepts at most 2 arguments: .slice(start?, end?).");
        for (const arg of node.arguments) {
          if (ts.isPrefixUnaryExpression(arg) && arg.operator === ts.SyntaxKind.MinusToken) {
            throw new Error("Array .slice() does not support negative indices. Solidity uses uint256 for array indices.");
          }
        }
        _neededArrayHelpers.add(`slice_${typeSuffix}`);
        const startArg = node.arguments.length >= 1 ? parseExpression(node.arguments[0]) : mkNum("0");
        const endArg = node.arguments.length >= 2 ? parseExpression(node.arguments[1]) : mkProp(receiverExpr, "length");
        return {
          kind: "call" as const,
          callee: { kind: "identifier" as const, name: `_arrSlice_${typeSuffix}` },
          args: [receiverExpr, startArg, endArg],
        };
      }

      // concat(other) → _arrConcat_T(arr, other)
      if (methodName === "concat" && node.arguments.length === 1) {
        const otherArg = node.arguments[0];
        if (ts.isPropertyAccessExpression(otherArg) && otherArg.expression.kind === ts.SyntaxKind.ThisKeyword) {
          const otherType = _currentVarTypes.get(otherArg.name.text);
          if (otherType?.kind === ("array" as SkittlesTypeKind)) {
            throw new Error(
              "Array .concat() cannot accept a storage array directly (e.g., this.a.concat(this.b)). " +
              "Use .slice() to copy to memory first: this.a.concat(this.b.slice(0, this.b.length))."
            );
          }
        }
        _neededArrayHelpers.add(`concat_${typeSuffix}`);
        return {
          kind: "call" as const,
          callee: { kind: "identifier" as const, name: `_arrConcat_${typeSuffix}` },
          args: [receiverExpr, parseExpression(otherArg)],
        };
      }

      // Callback-based methods: filter, map, forEach, some, every, find, findIndex, reduce
      if (["filter", "map", "forEach", "some", "every", "find", "findIndex", "reduce"].includes(methodName) && node.arguments.length >= 1) {
        const maxArity = methodName === "reduce" ? 2 : 1;
        if (node.arguments.length > maxArity) {
          throw new Error(`Array .${methodName}() accepts at most ${maxArity} argument(s), but ${node.arguments.length} were provided.`);
        }
        const callbackParamTypes = methodName === "reduce"
          ? { first: undefined, second: elementType }
          : { first: elementType };
        const callback = parseArrowCallback(node.arguments[0], callbackParamTypes);
        if (!callback) {
          throw new Error(`Array .${methodName}() requires an arrow function callback.`);
        }
        {
          const condExpr = callback.bodyExpr;

          if (!condExpr && methodName !== "forEach") {
            throw new Error(`Array .${methodName}() requires an arrow function with an expression body (e.g., v => v > 10). Block-bodied callbacks are only supported for .forEach().`);
          }

          {
            const allowedNames = new Set<string>([callback.paramName]);
            if (callback.secondParamName) allowedNames.add(callback.secondParamName);
            validateCallbackScope(condExpr ?? null, callback.bodyStmts, allowedNames, methodName);
          }

          // Helper to create a this._helperName() call for mutability propagation
          const mkHelperCall = (name: string): Expression => ({
            kind: "call" as const,
            callee: mkProp(mkId("this"), name),
            args: [],
          });

          if (methodName === "filter" && condExpr) {
            const helper = generateFilterHelper(receiverExpr, elementType, callback.paramName, condExpr);
            _generatedArrayFunctions.push(helper);
            return mkHelperCall(helper.name);
          }

          if (methodName === "map" && condExpr) {
            const callbackEnv = new Map(_currentVarTypes);
            if (callback.paramName && elementType) callbackEnv.set(callback.paramName, elementType);
            const resultType = inferType(condExpr, callbackEnv);
            const helper = generateMapHelper(receiverExpr, elementType, callback.paramName, condExpr, resultType);
            _generatedArrayFunctions.push(helper);
            return mkHelperCall(helper.name);
          }

          if (methodName === "some" && condExpr) {
            const helper = generateSomeEveryHelper("some", receiverExpr, elementType, callback.paramName, condExpr);
            _generatedArrayFunctions.push(helper);
            return mkHelperCall(helper.name);
          }

          if (methodName === "every" && condExpr) {
            const helper = generateSomeEveryHelper("every", receiverExpr, elementType, callback.paramName, condExpr);
            _generatedArrayFunctions.push(helper);
            return mkHelperCall(helper.name);
          }

          if (methodName === "find" && condExpr) {
            const helper = generateFindHelper(receiverExpr, elementType, callback.paramName, condExpr);
            _generatedArrayFunctions.push(helper);
            return mkHelperCall(helper.name);
          }

          if (methodName === "findIndex" && condExpr) {
            const helper = generateFindIndexHelper(receiverExpr, elementType, callback.paramName, condExpr);
            _generatedArrayFunctions.push(helper);
            return mkHelperCall(helper.name);
          }

          if (methodName === "reduce") {
            if (!callback.secondParamName) throw new Error("Array .reduce() callback must have two parameters: (accumulator, item) => expression.");
            if (node.arguments.length < 2) throw new Error("Array .reduce() requires an initial value as the second argument.");
            const initialValue = parseExpression(node.arguments[1]);
            const accType = inferType(initialValue, _currentVarTypes);
            const helper = generateReduceHelper(receiverExpr, elementType, callback.paramName, callback.secondParamName, condExpr!, initialValue, accType);
            _generatedArrayFunctions.push(helper);
            return mkHelperCall(helper.name);
          }

          // forEach: desugar to a for loop (via a helper that returns nothing)
          if (methodName === "forEach") {
            const helperName = `_forEach_${_arrayMethodCounter++}`;
            const elemType = elementType ?? UINT256_TYPE;
            const forBody: Statement[] = [mkVarDecl(callback.paramName, elemType, mkElem(receiverExpr, mkId("__sk_i")))];
            if (callback.bodyExpr) {
              forBody.push(mkExprStmt(callback.bodyExpr));
            } else if (callback.bodyStmts) {
              forBody.push(...callback.bodyStmts);
            }
            const body: Statement[] = [mkForLoop("__sk_i", receiverExpr, forBody)];
            const helperMutability = inferStateMutability(body, _currentVarTypes);
            const helper: SkittlesFunction = {
              name: helperName, parameters: [], returnType: null,
              visibility: "private", stateMutability: helperMutability,
              isVirtual: false, isOverride: false, body,
            };
            _generatedArrayFunctions.push(helper);
            return mkHelperCall(helperName);
          }
        }
      }

      // remove(value) → _arrRemove_T(arr, value)
      if (methodName === "remove" && node.arguments.length === 1) {
        if (isNonComparable) throw new Error(`Unsupported: .remove() on ${typeSuffix}[] arrays. Element type does not support equality in Solidity. Use .findIndex() with a callback and .splice() instead.`);
        _neededArrayHelpers.add(`remove_${typeSuffix}`);
        return {
          kind: "call" as const,
          callee: { kind: "identifier" as const, name: `_arrRemove_${typeSuffix}` },
          args: [receiverExpr, parseExpression(node.arguments[0])],
        };
      }

      // reverse() → _arrReverse_T(arr)
      if (methodName === "reverse" && node.arguments.length === 0) {
        if (node.parent && !ts.isExpressionStatement(node.parent)) {
          throw new Error("Array .reverse() modifies the array in place and does not return a value. Use it as a standalone statement.");
        }
        _neededArrayHelpers.add(`reverse_${typeSuffix}`);
        return {
          kind: "call" as const,
          callee: { kind: "identifier" as const, name: `_arrReverse_${typeSuffix}` },
          args: [receiverExpr],
        };
      }

      // splice(start, deleteCount) → _arrSplice_T(arr, start, deleteCount)
      if (methodName === "splice" && node.arguments.length >= 1) {
        if (node.parent && !ts.isExpressionStatement(node.parent)) {
          throw new Error("Array .splice() modifies the array in place and does not return a value. Use it as a standalone statement.");
        }
        if (node.arguments.length > 2) throw new Error("Array .splice() only supports deletion (up to 2 arguments). Insertion via splice(start, count, ...items) is not supported.");
        for (const arg of node.arguments) {
          if (ts.isPrefixUnaryExpression(arg) && arg.operator === ts.SyntaxKind.MinusToken) {
            throw new Error("Array .splice() does not support negative indices. Solidity uses uint256 for array indices.");
          }
        }
        _neededArrayHelpers.add(`splice_${typeSuffix}`);
        const startArg = parseExpression(node.arguments[0]);
        const countArg = node.arguments.length >= 2 ? parseExpression(node.arguments[1]) : mkNum("1");
        return {
          kind: "call" as const,
          callee: { kind: "identifier" as const, name: `_arrSplice_${typeSuffix}` },
          args: [receiverExpr, startArg, countArg],
        };
      }

      if (KNOWN_ARRAY_METHODS.has(methodName)) {
        throw new Error(`Array .${methodName}() called with unsupported arguments. Check the method signature in the Skittles documentation.`);
      }
    }

    // String method calls: str.charAt(i) → _charAt(str, i), etc.
    if (ts.isPropertyAccessExpression(node.expression)) {
      const methodName = node.expression.name.text;
      const methodDef = STRING_METHODS[methodName];
      if (methodDef) {
        const receiver = parseExpression(node.expression.expression);
        if (isStringExpr(receiver)) {
          const argCount = node.arguments.length;
          if (argCount > methodDef.maxArgs) {
            const overloadHint = methodDef.minArgs < methodDef.maxArgs
              ? `Skittles supports: str.${methodName}(${describeExpectedArgs(methodName, methodDef.minArgs)}) or str.${methodName}(${describeExpectedArgs(methodName, methodDef.maxArgs)}).`
              : `Skittles only supports: str.${methodName}(${describeExpectedArgs(methodName, methodDef.maxArgs)}).`;
            throw new Error(
              `String method .${methodName}() accepts at most ${methodDef.maxArgs} argument(s), but ${argCount} were provided. ` +
              overloadHint
            );
          }
          if (argCount < methodDef.minArgs) {
            throw new Error(
              `String method .${methodName}() requires at least ${methodDef.minArgs} argument(s), but ${argCount} were provided.`
            );
          }
          const args = node.arguments.map(parseExpression);
          // charAt() without index → charAt(0)
          if (methodName === "charAt" && args.length === 0) {
            args.push({ kind: "number-literal" as const, value: "0" });
          }
          // substring(start) without end → substring(start, bytes(str).length)
          if (methodName === "substring" && args.length === 1) {
            args.push({
              kind: "property-access" as const,
              object: {
                kind: "call" as const,
                callee: { kind: "identifier" as const, name: "bytes" },
                args: [receiver],
              },
              property: "length",
            });
          }
          return {
            kind: "call" as const,
            callee: { kind: "identifier" as const, name: methodDef.helper },
            args: [receiver, ...args],
          };
        }
      }
    }

    const callExpr: {
      kind: "call";
      callee: Expression;
      args: Expression[];
      typeArgs?: SkittlesType[];
    } = {
      kind: "call",
      callee: parseExpression(node.expression),
      args: node.arguments.map(parseExpression),
    };

    if (node.typeArguments && node.typeArguments.length > 0) {
      const firstTypeArg = node.typeArguments[0];
      if (ts.isTupleTypeNode(firstTypeArg)) {
        callExpr.typeArgs = firstTypeArg.elements.map((elem) => {
          if (ts.isNamedTupleMember(elem)) {
            return parseType(elem.type);
          }
          return parseType(elem);
        });
      } else {
        callExpr.typeArgs = node.typeArguments.map((ta) => parseType(ta));
      }
    }

    return callExpr;
  }

  if (ts.isNewExpression(node)) {
    const callee = ts.isIdentifier(node.expression)
      ? node.expression.text
      : "Unknown";
    const args = node.arguments
      ? Array.from(node.arguments).map(parseExpression)
      : [];
    return { kind: "new", callee, args };
  }

  if (ts.isParenthesizedExpression(node)) {
    return parseExpression(node.expression);
  }

  if (ts.isAsExpression(node)) {
    return parseExpression(node.expression);
  }

  if (ts.isNonNullExpression(node)) {
    return parseExpression(node.expression);
  }

  // Angle bracket type assertion: <Type>value (transparent, like 'as')
  if (ts.isTypeAssertionExpression(node)) {
    return parseExpression(node.expression);
  }

  // void operator: `void expr` → just the expression (value discarded)
  if (ts.isVoidExpression(node)) {
    return parseExpression(node.expression);
  }

  if (ts.isConditionalExpression(node)) {
    return {
      kind: "conditional",
      condition: parseExpression(node.condition),
      whenTrue: parseExpression(node.whenTrue),
      whenFalse: parseExpression(node.whenFalse),
    };
  }

  // Array literal expressions: [a, b, c] → tuple literal
  if (ts.isArrayLiteralExpression(node)) {
    const hasSpread = node.elements.some(ts.isSpreadElement);

    if (hasSpread) {
      // Spread array expression: [...a, ...b] → _arrSpread_T(a, b)
      const nonSpread = node.elements.find((e: ts.Expression) => !ts.isSpreadElement(e));
      if (nonSpread) {
        throw new Error("Array spread does not support mixing spread and non-spread elements. Use [...a, ...b] or build the array manually.");
      }

      const spreadExprs = node.elements.map((e: ts.Expression) => {
        if (!ts.isSpreadElement(e)) throw new Error("Unexpected non-spread element");
        return e.expression;
      });

      // Resolve element type from the first spread operand
      let elementType: SkittlesType | undefined;
      for (const spreadExpr of spreadExprs) {
        elementType = resolveSpreadElementType(spreadExpr);
        if (elementType) break;
      }
      if (!elementType) {
        throw new Error(
          "Could not resolve element type for array spread. " +
          "Ensure spread operands are arrays with statically known element types."
        );
      }
      const typeSuffix = getArrayHelperSuffix(elementType);

      _neededArrayHelpers.add(`spread_${typeSuffix}`);

      // Parse each spread operand, wrapping storage arrays in a slice call
      const parsedOperands: Expression[] = spreadExprs.map((e: ts.Expression) => {
        if (ts.isPropertyAccessExpression(e) && e.expression.kind === ts.SyntaxKind.ThisKeyword) {
          const name = e.name.text;
          const type = _currentVarTypes.get(name);
          if (type?.kind === ("array" as SkittlesTypeKind)) {
            // Storage array: wrap in slice to copy to memory
            _neededArrayHelpers.add(`slice_${typeSuffix}`);
            const parsed = parseExpression(e);
            return {
              kind: "call" as const,
              callee: { kind: "identifier" as const, name: `_arrSlice_${typeSuffix}` },
              args: [
                parsed,
                { kind: "number-literal" as const, value: "0" },
                { kind: "property-access" as const, object: parsed, property: "length" },
              ],
            };
          }
        }
        return parseExpression(e);
      });

      // Chain calls for 2+ arrays: _arrSpread_T(_arrSpread_T(a, b), c)
      let result: Expression = parsedOperands[0];
      for (let i = 1; i < parsedOperands.length; i++) {
        result = {
          kind: "call" as const,
          callee: { kind: "identifier" as const, name: `_arrSpread_${typeSuffix}` },
          args: [result, parsedOperands[i]],
        };
      }
      return result;
    }

    return {
      kind: "tuple-literal",
      elements: node.elements.map(parseExpression),
    };
  }

  // Object literal expressions: { x: 1, y: 2 } → struct construction
  if (ts.isObjectLiteralExpression(node)) {
    const properties: { name: string; value: Expression }[] = [];
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
        properties.push({ name: prop.name.text, value: parseExpression(prop.initializer) });
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        properties.push({ name: prop.name.text, value: { kind: "identifier", name: prop.name.text } });
      }
    }
    return { kind: "object-literal", properties };
  }

  // Template literals: `hello ${name}` → string.concat("hello ", name)
  if (ts.isTemplateExpression(node)) {
    const parts: Expression[] = [];
    if (node.head.text) {
      parts.push({ kind: "string-literal", value: node.head.text });
    }
    for (const span of node.templateSpans) {
      parts.push(parseExpression(span.expression));
      if (span.literal.text) {
        parts.push({ kind: "string-literal", value: span.literal.text });
      }
    }
    // Wrap in string.concat(...)
    return {
      kind: "call",
      callee: {
        kind: "property-access",
        object: { kind: "identifier", name: "string" },
        property: "concat",
      },
      args: parts,
    };
  }

  // No-substitution template literal: `hello` → "hello"
  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return { kind: "string-literal", value: node.text };
  }

  throw new Error(`Unsupported expression: ${ts.SyntaxKind[node.kind]}`);
}

// ============================================================
// Statement parsing
// ============================================================

export function parseStatement(
  node: ts.Statement,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string> = new Set()
): Statement {
  if (ts.isReturnStatement(node)) {
    return {
      kind: "return",
      value: node.expression
        ? parseExpression(node.expression)
        : undefined,
      sourceLine: getSourceLine(node),
    };
  }

  if (ts.isVariableStatement(node)) {
    const decl = node.declarationList.declarations[0];
    const name = ts.isIdentifier(decl.name) ? decl.name.text : "unknown";
    const explicitType = decl.type ? parseType(decl.type) : undefined;
    const initializer = decl.initializer
      ? parseExpression(decl.initializer)
      : undefined;
    const type =
      explicitType || (initializer ? inferType(initializer, varTypes) : undefined);

    if (type?.kind === ("string" as SkittlesTypeKind)) {
      _currentStringNames.add(name);
    }

    return { kind: "variable-declaration", name, type, initializer, sourceLine: getSourceLine(node) };
  }

  if (ts.isExpressionStatement(node)) {
    const emitStmt = tryParseEmitStatement(node.expression, eventNames);
    if (emitStmt) {
      emitStmt.sourceLine = getSourceLine(node);
      return emitStmt;
    }

    const consoleLogStmt = tryParseConsoleLog(node.expression);
    if (consoleLogStmt) {
      consoleLogStmt.sourceLine = getSourceLine(node);
      return consoleLogStmt;
    }

    // Detect delete expressions: `delete this.mapping[key]`
    if (ts.isDeleteExpression(node.expression)) {
      return { kind: "delete", target: parseExpression(node.expression.expression), sourceLine: getSourceLine(node) };
    }

    // Map.delete(key) → delete mapping[key]
    if (ts.isCallExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        node.expression.expression.name.text === "delete" &&
        node.expression.arguments.length === 1 &&
        isMappingLikeReceiver(node.expression.expression.expression)) {
      return {
        kind: "delete" as const,
        target: {
          kind: "element-access" as const,
          object: parseExpression(node.expression.expression.expression),
          index: parseExpression(node.expression.arguments[0]),
        },
        sourceLine: getSourceLine(node),
      };
    }

    // Map.set(key, value) → mapping[key] = value
    if (ts.isCallExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        node.expression.expression.name.text === "set" &&
        node.expression.arguments.length === 2 &&
        isMappingLikeReceiver(node.expression.expression.expression)) {
      return {
        kind: "expression" as const,
        expression: {
          kind: "assignment" as const,
          operator: "=",
          target: {
            kind: "element-access" as const,
            object: parseExpression(node.expression.expression.expression),
            index: parseExpression(node.expression.arguments[0]),
          },
          value: parseExpression(node.expression.arguments[1]),
        },
        sourceLine: getSourceLine(node),
      };
    }

    return { kind: "expression", expression: parseExpression(node.expression), sourceLine: getSourceLine(node) };
  }

  if (ts.isIfStatement(node)) {
    const condition = parseExpression(node.expression);
    const thenBody = parseBlock(node.thenStatement, varTypes, eventNames);
    const elseBody = node.elseStatement
      ? parseBlock(node.elseStatement, varTypes, eventNames)
      : undefined;
    return { kind: "if", condition, thenBody, elseBody, sourceLine: getSourceLine(node) };
  }

  if (ts.isForStatement(node)) {
    let initializer:
      | { kind: "variable-declaration"; name: string; type?: SkittlesType; initializer?: Expression }
      | { kind: "expression"; expression: Expression }
      | undefined;

    if (node.initializer) {
      if (ts.isVariableDeclarationList(node.initializer)) {
        const decl = node.initializer.declarations[0];
        const n = ts.isIdentifier(decl.name) ? decl.name.text : "unknown";
        const t = decl.type ? parseType(decl.type) : undefined;
        const init = decl.initializer
          ? parseExpression(decl.initializer)
          : undefined;
        initializer = {
          kind: "variable-declaration",
          name: n,
          type: t || (init ? inferType(init, varTypes) : undefined),
          initializer: init,
        };
      } else {
        initializer = {
          kind: "expression",
          expression: parseExpression(node.initializer),
        };
      }
    }

    return {
      kind: "for",
      initializer,
      condition: node.condition
        ? parseExpression(node.condition)
        : undefined,
      incrementor: node.incrementor
        ? parseExpression(node.incrementor)
        : undefined,
      body: parseBlock(node.statement, varTypes, eventNames),
      sourceLine: getSourceLine(node),
    };
  }

  if (ts.isWhileStatement(node)) {
    return {
      kind: "while",
      condition: parseExpression(node.expression),
      body: parseBlock(node.statement, varTypes, eventNames),
      sourceLine: getSourceLine(node),
    };
  }

  if (ts.isDoStatement(node)) {
    return {
      kind: "do-while",
      condition: parseExpression(node.expression),
      body: parseBlock(node.statement, varTypes, eventNames),
      sourceLine: getSourceLine(node),
    };
  }

  if (node.kind === ts.SyntaxKind.BreakStatement) {
    return { kind: "break", sourceLine: getSourceLine(node) };
  }

  if (node.kind === ts.SyntaxKind.ContinueStatement) {
    return { kind: "continue", sourceLine: getSourceLine(node) };
  }

  if (ts.isForOfStatement(node)) {
    // Desugar: for (const item of arr) { ... }
    // →  for (uint256 _i = 0; _i < arr.length; _i++) { T item = arr[_i]; ... }
    const arrExpr = parseExpression(node.expression);
    const itemName = ts.isVariableDeclarationList(node.initializer)
      ? (ts.isIdentifier(node.initializer.declarations[0].name) ? node.initializer.declarations[0].name.text : "_item")
      : "_item";

    const itemTypeNode = ts.isVariableDeclarationList(node.initializer) && node.initializer.declarations[0].type
      ? parseType(node.initializer.declarations[0].type)
      : undefined;

    const indexName = `_i_${itemName}`;
    const innerBody = parseBlock(node.statement, varTypes, eventNames);

    // Prepend: T item = arr[_i];
    const itemDecl: Statement = {
      kind: "variable-declaration",
      name: itemName,
      type: itemTypeNode,
      initializer: {
        kind: "element-access",
        object: arrExpr,
        index: { kind: "identifier", name: indexName },
      },
    };

    return {
      kind: "for",
      initializer: {
        kind: "variable-declaration",
        name: indexName,
        type: { kind: "uint256" as SkittlesTypeKind },
        initializer: { kind: "number-literal", value: "0" },
      },
      condition: {
        kind: "binary",
        operator: "<",
        left: { kind: "identifier", name: indexName },
        right: {
          kind: "property-access",
          object: arrExpr,
          property: "length",
        },
      },
      incrementor: {
        kind: "unary",
        operator: "++",
        operand: { kind: "identifier", name: indexName },
        prefix: false,
      },
      body: [itemDecl, ...innerBody],
      sourceLine: getSourceLine(node),
    };
  }

  if (ts.isForInStatement(node)) {
    // Desugar: for (const item in EnumType) { ... }
    // →  for (uint256 _i = 0; _i < memberCount; _i++) { EnumType item = EnumType(_i); ... }
    const enumName = ts.isIdentifier(node.expression) ? node.expression.text : "";
    const enumMembers = _knownEnums.get(enumName);

    if (enumMembers) {
      const itemName = ts.isVariableDeclarationList(node.initializer)
        ? (ts.isIdentifier(node.initializer.declarations[0].name) ? node.initializer.declarations[0].name.text : "_item")
        : "_item";

      const indexName = `_i_${itemName}`;
      const innerBody = parseBlock(node.statement, varTypes, eventNames);

      // Prepend: EnumType item = EnumType(_i);
      const itemDecl: Statement = {
        kind: "variable-declaration",
        name: itemName,
        type: { kind: "enum" as SkittlesTypeKind, structName: enumName },
        initializer: {
          kind: "call",
          callee: { kind: "identifier", name: enumName },
          args: [{ kind: "identifier", name: indexName }],
        },
      };

      return {
        kind: "for",
        initializer: {
          kind: "variable-declaration",
          name: indexName,
          type: { kind: "uint256" as SkittlesTypeKind },
          initializer: { kind: "number-literal", value: "0" },
        },
        condition: {
          kind: "binary",
          operator: "<",
          left: { kind: "identifier", name: indexName },
          right: { kind: "number-literal", value: String(enumMembers.length) },
        },
        incrementor: {
          kind: "unary",
          operator: "++",
          operand: { kind: "identifier", name: indexName },
          prefix: false,
        },
        body: [itemDecl, ...innerBody],
      };
    }
  }

  if (ts.isSwitchStatement(node)) {
    const discriminant = parseExpression(node.expression);
    const cases: SwitchCase[] = [];
    for (const clause of node.caseBlock.clauses) {
      const body: Statement[] = [];
      for (const stmt of clause.statements) {
        // Skip break statements inside switch cases (they are implicit in our if/else conversion)
        if (stmt.kind === ts.SyntaxKind.BreakStatement) continue;
        body.push(...parseStatements(stmt, varTypes, eventNames));
      }
      if (ts.isCaseClause(clause)) {
        cases.push({ value: parseExpression(clause.expression), body });
      } else {
        // DefaultClause
        cases.push({ value: undefined, body });
      }
    }
    return { kind: "switch", discriminant, cases, sourceLine: getSourceLine(node) };
  }

  if (ts.isTryStatement(node)) {
    const tryBlock = node.tryBlock;
    const catchClause = node.catchClause;
    const tryStatements = tryBlock.statements;

    if (tryStatements.length === 0) {
      throw new Error("try block must contain at least one statement with an external call");
    }

    // The first statement must be an external call (either variable declaration or expression)
    const firstStmt = tryStatements[0];
    let call: Expression;
    let returnVarName: string | undefined;
    let returnType: SkittlesType | undefined;

    if (ts.isVariableStatement(firstStmt)) {
      const decl = firstStmt.declarationList.declarations[0];
      returnVarName = ts.isIdentifier(decl.name) ? decl.name.text : undefined;
      returnType = decl.type ? parseType(decl.type) : undefined;
      if (decl.initializer) {
        call = parseExpression(decl.initializer);
        if (!returnType) {
          returnType = inferType(call, varTypes);
        }
      } else {
        throw new Error("try block variable declaration must have an initializer with an external call");
      }
    } else if (ts.isExpressionStatement(firstStmt)) {
      call = parseExpression(firstStmt.expression);
    } else {
      throw new Error("First statement in try block must be an external call");
    }

    // Remaining statements become success body
    const successBody: Statement[] = [];
    for (let i = 1; i < tryStatements.length; i++) {
      successBody.push(...parseStatements(tryStatements[i], varTypes, eventNames));
    }

    // Parse catch body
    const catchBody: Statement[] = [];
    if (catchClause && catchClause.block) {
      for (const stmt of catchClause.block.statements) {
        catchBody.push(...parseStatements(stmt, varTypes, eventNames));
      }
    }

    return { kind: "try-catch", call, returnVarName, returnType, successBody, catchBody };
  }

  if (ts.isThrowStatement(node)) {
    // Pattern: throw new ErrorName(args) (class extends Error style)
    if (node.expression && ts.isNewExpression(node.expression)) {
      const errorName = node.expression.expression && ts.isIdentifier(node.expression.expression)
        ? node.expression.expression.text
        : "";

      if (errorName !== "Error" && _knownCustomErrors.has(errorName)) {
        const args = node.expression.arguments
          ? Array.from(node.expression.arguments).map(parseExpression)
          : [];
        return { kind: "revert", customError: errorName, customErrorArgs: args, sourceLine: getSourceLine(node) };
      }

      let message: Expression | undefined;
      if (
        node.expression.arguments &&
        node.expression.arguments.length > 0
      ) {
        message = parseExpression(node.expression.arguments[0]);
      }
      return { kind: "revert", message, sourceLine: getSourceLine(node) };
    }

    // Pattern: throw this.ErrorName(args) (SkittlesError property style)
    if (node.expression && ts.isCallExpression(node.expression)) {
      const callee = node.expression.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.expression.kind === ts.SyntaxKind.ThisKeyword
      ) {
        const errorName = callee.name.text;
        if (_knownCustomErrors.has(errorName)) {
          const args = node.expression.arguments.map(parseExpression);
          return { kind: "revert", customError: errorName, customErrorArgs: args, sourceLine: getSourceLine(node) };
        }
      }
    }

    return { kind: "revert", sourceLine: getSourceLine(node) };
  }

  throw new Error(`Unsupported statement: ${ts.SyntaxKind[node.kind]}`);
}

function parseBlock(
  node: ts.Statement,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string> = new Set()
): Statement[] {
  if (ts.isBlock(node)) {
    return node.statements.flatMap((s) => parseStatements(s, varTypes, eventNames));
  }
  return parseStatements(node, varTypes, eventNames);
}

/**
 * Parse a single TS statement into one or more IR statements.
 * Multi-declaration variable statements (let a=1, b=2) expand to multiple.
 */
function parseStatements(
  node: ts.Statement,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): Statement[] {
  if (ts.isVariableStatement(node)) {
    // Multi declaration: let a=1, b=2, c=3
    if (node.declarationList.declarations.length > 1) {
      const sl = getSourceLine(node);
      return node.declarationList.declarations.map((decl) => {
        const name = ts.isIdentifier(decl.name) ? decl.name.text : "unknown";
        const explicitType = decl.type ? parseType(decl.type) : undefined;
        const initializer = decl.initializer
          ? parseExpression(decl.initializer)
          : undefined;
        const type =
          explicitType || (initializer ? inferType(initializer, varTypes) : undefined);
        if (type?.kind === ("string" as SkittlesTypeKind)) {
          _currentStringNames.add(name);
        }
        return { kind: "variable-declaration" as const, name, type, initializer, sourceLine: sl };
      });
    }

    // Array destructuring: const [a, b, c] = [7, 8, 9]
    const decl = node.declarationList.declarations[0];
    if (decl.name && ts.isArrayBindingPattern(decl.name) && decl.initializer) {
      return parseArrayDestructuring(decl.name, decl.initializer, varTypes);
    }

    // Object destructuring: const { a, b } = { a: 1, b: 2 }
    if (decl.name && ts.isObjectBindingPattern(decl.name) && decl.initializer) {
      return parseObjectDestructuring(decl.name, decl.initializer, varTypes, decl);
    }
  }
  return [parseStatement(node, varTypes, eventNames)];
}

// ============================================================
// Emit detection: this.EventName.emit(args) or this.EventName.emit({...})
// ============================================================

function tryParseEmitStatement(
  node: ts.Expression,
  eventNames: Set<string>
): EmitStatement | null {
  if (!ts.isCallExpression(node)) return null;

  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee)) return null;
  if (callee.name.text !== "emit") return null;

  const obj = callee.expression;
  if (!ts.isPropertyAccessExpression(obj)) return null;
  if (obj.expression.kind !== ts.SyntaxKind.ThisKeyword) return null;

  const eventName = obj.name.text;
  if (!eventNames.has(eventName)) return null;

  // Handle both positional args and single object literal arg
  if (
    node.arguments.length === 1 &&
    ts.isObjectLiteralExpression(node.arguments[0])
  ) {
    const objLit = node.arguments[0];
    const args: Expression[] = [];
    for (const prop of objLit.properties) {
      if (ts.isPropertyAssignment(prop)) {
        args.push(parseExpression(prop.initializer));
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        args.push({ kind: "identifier", name: prop.name.text });
      }
    }
    return { kind: "emit", eventName, args };
  }

  const args = node.arguments.map(parseExpression);
  return { kind: "emit", eventName, args };
}

// ============================================================
// Console.log detection: console.log(args)
// ============================================================

function tryParseConsoleLog(
  node: ts.Expression
): ConsoleLogStatement | null {
  if (!ts.isCallExpression(node)) return null;

  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee)) return null;
  if (callee.name.text !== "log") return null;

  const obj = callee.expression;
  if (!ts.isIdentifier(obj) || obj.text !== "console") return null;

  const args = node.arguments.map(parseExpression);
  return { kind: "console-log", args };
}

// ============================================================
// State mutability inference
// ============================================================

/**
 * Propagate state mutability across call chains.
 * If function A calls this.B() and B is nonpayable, A becomes nonpayable.
 * If function A calls this.B() and B is view, A becomes at least view.
 * Uses fixpoint iteration until stable.
 */
function propagateStateMutability(functions: SkittlesFunction[]): void {
  type Mut = "pure" | "view" | "nonpayable" | "payable";
  const rank: Record<Mut, number> = { pure: 0, view: 1, nonpayable: 2, payable: 3 };

  const mutMap = new Map<string, Mut>();
  for (const f of functions) {
    mutMap.set(f.name, f.stateMutability as Mut);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const f of functions) {
      const calledMethods = collectThisCalls(f.body);
      for (const methodName of calledMethods) {
        const calledMut = mutMap.get(methodName);
        if (!calledMut) continue;

        const currentRank = rank[f.stateMutability as Mut] ?? 0;
        const calledRank = rank[calledMut];

        if (calledRank > currentRank) {
          f.stateMutability = calledMut as Mut;
          mutMap.set(f.name, calledMut);
          changed = true;
        }
      }
    }
  }
}

/**
 * Generic AST walker. Calls onExpr for every expression and onStmt for every
 * statement in the tree. Both callbacks are optional.
 */
function walkStatements(
  stmts: Statement[],
  onExpr?: (expr: Expression) => void,
  onStmt?: (stmt: Statement) => void
): void {
  function walkExpr(expr: Expression): void {
    if (onExpr) onExpr(expr);
    switch (expr.kind) {
      case "binary":
        walkExpr(expr.left);
        walkExpr(expr.right);
        break;
      case "unary":
        walkExpr(expr.operand);
        break;
      case "assignment":
        walkExpr(expr.target);
        walkExpr(expr.value);
        break;
      case "call":
        walkExpr(expr.callee);
        expr.args.forEach(walkExpr);
        break;
      case "property-access":
        walkExpr(expr.object);
        break;
      case "element-access":
        walkExpr(expr.object);
        walkExpr(expr.index);
        break;
      case "conditional":
        walkExpr(expr.condition);
        walkExpr(expr.whenTrue);
        walkExpr(expr.whenFalse);
        break;
      case "new":
        expr.args.forEach(walkExpr);
        break;
      case "object-literal":
        expr.properties.forEach((p) => walkExpr(p.value));
        break;
    }
  }

  function walkStmt(stmt: Statement): void {
    if (onStmt) onStmt(stmt);
    switch (stmt.kind) {
      case "return":
        if (stmt.value) walkExpr(stmt.value);
        break;
      case "variable-declaration":
        if (stmt.initializer) walkExpr(stmt.initializer);
        break;
      case "expression":
        walkExpr(stmt.expression);
        break;
      case "if":
        walkExpr(stmt.condition);
        stmt.thenBody.forEach(walkStmt);
        stmt.elseBody?.forEach(walkStmt);
        break;
      case "for":
        if (stmt.initializer) walkStmt(stmt.initializer);
        if (stmt.condition) walkExpr(stmt.condition);
        if (stmt.incrementor) walkExpr(stmt.incrementor);
        stmt.body.forEach(walkStmt);
        break;
      case "while":
        walkExpr(stmt.condition);
        stmt.body.forEach(walkStmt);
        break;
      case "revert":
        if (stmt.message) walkExpr(stmt.message);
        break;
      case "do-while":
        walkExpr(stmt.condition);
        stmt.body.forEach(walkStmt);
        break;
      case "emit":
        stmt.args.forEach(walkExpr);
        break;
      case "switch":
        walkExpr(stmt.discriminant);
        for (const c of stmt.cases) {
          if (c.value) walkExpr(c.value);
          c.body.forEach(walkStmt);
        }
        break;
      case "delete":
        walkExpr(stmt.target);
        break;
      case "try-catch":
        walkExpr(stmt.call);
        stmt.successBody.forEach(walkStmt);
        stmt.catchBody.forEach(walkStmt);
        break;
      case "console-log":
        stmt.args.forEach(walkExpr);
        break;
    }
  }

  stmts.forEach(walkStmt);
}

function collectThisCalls(stmts: Statement[]): string[] {
  const names: string[] = [];
  walkStatements(stmts, (expr) => {
    if (
      expr.kind === "call" &&
      expr.callee.kind === "property-access" &&
      expr.callee.object.kind === "identifier" &&
      expr.callee.object.name === "this"
    ) {
      names.push(expr.callee.property);
    }
  });
  return names;
}

/**
 * Collect external interface method calls from a function body.
 * Returns an array of { ifaceName, methodName } pairs.
 */
function collectExternalInterfaceCalls(
  stmts: Statement[],
  stateVarTypes: Map<string, SkittlesType>,
  allVarTypes: Map<string, SkittlesType>
): { ifaceName: string; methodName: string }[] {
  const calls: { ifaceName: string; methodName: string }[] = [];
  // Track local variable types for detecting external contract calls on locals
  const localVarTypes = new Map<string, SkittlesType>(allVarTypes);
  walkStatements(stmts, (expr) => {
    if (expr.kind !== "call" || expr.callee.kind !== "property-access") return;
    const methodName = expr.callee.property;

    // this.token.method() — state variable access (use stateVarTypes, not locals)
    if (
      expr.callee.object.kind === "property-access" &&
      expr.callee.object.object.kind === "identifier" &&
      expr.callee.object.object.name === "this"
    ) {
      const propType = stateVarTypes.get(expr.callee.object.property);
      if (propType?.kind === ("contract-interface" as SkittlesTypeKind) && propType.structName) {
        calls.push({ ifaceName: propType.structName, methodName });
      }
    }

    // token.method() — local/param variable access
    if (
      expr.callee.object.kind === "identifier" &&
      expr.callee.object.name !== "this"
    ) {
      const varType = localVarTypes.get(expr.callee.object.name);
      if (varType?.kind === ("contract-interface" as SkittlesTypeKind) && varType.structName) {
        calls.push({ ifaceName: varType.structName, methodName });
      }
    }
  }, (stmt) => {
    // Track local variable declarations of contract-interface types
    if (stmt.kind === "variable-declaration" && stmt.type &&
        stmt.type.kind === ("contract-interface" as SkittlesTypeKind) && stmt.name) {
      localVarTypes.set(stmt.name, stmt.type);
    }
  });
  return calls;
}

function inferAbstractStateMutability(): StateMutability {
  return "nonpayable";
}

export function inferStateMutability(body: Statement[], varTypes?: Map<string, SkittlesType>, params?: SkittlesParameter[], skipExternalCalls?: boolean): "pure" | "view" | "nonpayable" | "payable" {
  let readsState = false;
  let writesState = false;
  let usesMsgValue = false;
  let readsEnvironment = false;

  const thisCallCallees = new Set<Expression>();

  // Track local variable types for detecting external contract calls on locals
  const localVarTypes = new Map<string, SkittlesType>();
  if (params) {
    for (const p of params) {
      localVarTypes.set(p.name, p.type);
    }
  }

  walkStatements(
    body,
    (expr) => {
      if (
        expr.kind === "call" &&
        expr.callee.kind === "property-access" &&
        expr.callee.object.kind === "identifier" &&
        expr.callee.object.name === "this"
      ) {
        thisCallCallees.add(expr.callee);
      }
      if (expr.kind === "property-access") {
        if (expr.object.kind === "identifier" && expr.object.name === "this" && !thisCallCallees.has(expr)) {
          readsState = true;
        }
        if (
          expr.object.kind === "identifier" &&
          expr.object.name === "msg" &&
          expr.property === "value"
        ) {
          usesMsgValue = true;
        }
        // EVM environment reads: msg.sender, msg.data, msg.sig, block.*, tx.*
        // (msg.value is excluded here because it is handled separately as payable)
        if (
          expr.object.kind === "identifier" &&
          (
            (expr.object.name === "msg" && expr.property !== "value") ||
            expr.object.name === "block" ||
            expr.object.name === "tx"
          )
        ) {
          readsEnvironment = true;
        }
      }
      // `self` reads the contract's own address (address(this))
      if (expr.kind === "identifier" && expr.name === "self") {
        readsEnvironment = true;
      }
      // `gasleft()` reads remaining gas from the environment
      if (
        expr.kind === "call" &&
        expr.callee.kind === "identifier" &&
        expr.callee.name === "gasleft"
      ) {
        readsEnvironment = true;
      }
      if (expr.kind === "assignment" && isStateAccess(expr.target)) {
        writesState = true;
      }
      if (
        expr.kind === "unary" &&
        (expr.operator === "++" || expr.operator === "--") &&
        isStateAccess(expr.operand)
      ) {
        writesState = true;
      }
      if (expr.kind === "call" && isStateMutatingCall(expr)) {
        writesState = true;
      }
      // Per-type array mutating helpers (codegen-emitted)
      if (expr.kind === "call" && expr.callee.kind === "identifier") {
        const n = expr.callee.name;
        if (n.startsWith("_arrRemove_") || n.startsWith("_arrReverse_") || n.startsWith("_arrSplice_")) {
          writesState = true;
        }
      }
      // addr.transfer(amount) sends ETH, which is state-mutating
      // Only match when the receiver is not `this` and not a contract-interface variable
      if (
        expr.kind === "call" &&
        expr.callee.kind === "property-access" &&
        expr.callee.property === "transfer" &&
        expr.args.length === 1 &&
        !isContractInterfaceReceiver(expr.callee.object, varTypes, localVarTypes)
      ) {
        writesState = true;
      }
      if (!skipExternalCalls && expr.kind === "call" && varTypes && isExternalContractCall(expr, varTypes)) {
        const methodMut = getExternalCallMethodMutability(expr, varTypes, localVarTypes);
        if (methodMut === "view") {
          readsState = true;
        } else if (methodMut !== "pure") {
          writesState = true;
        }
      }
      if (!skipExternalCalls && expr.kind === "call" && isExternalContractCallOnLocal(expr, localVarTypes)) {
        const methodMut = getExternalCallMethodMutability(expr, varTypes, localVarTypes);
        if (methodMut === "view") {
          readsState = true;
        } else if (methodMut !== "pure") {
          writesState = true;
        }
      }
    },
    (stmt) => {
      if (stmt.kind === "emit") {
        writesState = true;
      }
      if (stmt.kind === "delete" && isStateAccess(stmt.target)) {
        writesState = true;
      }
      if (stmt.kind === "variable-declaration" && stmt.type &&
          stmt.type.kind === ("contract-interface" as SkittlesTypeKind) && stmt.name) {
        localVarTypes.set(stmt.name, stmt.type);
      }
    }
  );

  if (usesMsgValue) return "payable";
  if (writesState) return "nonpayable";
  if (readsState || readsEnvironment) return "view";
  return "pure";
}

// ============================================================
// Cross-function mutability propagation
// ============================================================

const MUTABILITY_RANK: Record<StateMutability, number> = {
  pure: 0,
  view: 1,
  nonpayable: 2,
  payable: 3,
};

/**
 * After parsing all contracts in a file, propagate mutability from callees to
 * callers. If function A calls this.B(), and B is nonpayable, A must be at
 * least nonpayable. Handles inheritance: child functions can call parent
 * internal functions.
 */
function propagateMutability(contracts: SkittlesContract[]): void {
  const contractByName = new Map(contracts.map((c) => [c.name, c]));

  let globalChanged = true;
  while (globalChanged) {
    globalChanged = false;
    for (const contract of contracts) {
      const allFunctions = new Map<string, SkittlesFunction>();
      for (const fn of contract.functions) allFunctions.set(fn.name, fn);
      for (const parentName of contract.inherits) {
        const parent = contractByName.get(parentName);
        if (!parent) continue;
        for (const fn of parent.functions) {
          if (!allFunctions.has(fn.name)) allFunctions.set(fn.name, fn);
        }
      }

      for (const fn of contract.functions) {
        const calls = collectThisCalls(fn.body);
        for (const calledName of calls) {
          const callee = allFunctions.get(calledName);
          if (!callee) continue;
          if (MUTABILITY_RANK[callee.stateMutability] > MUTABILITY_RANK[fn.stateMutability]) {
            fn.stateMutability = callee.stateMutability;
            globalChanged = true;
          }
        }
      }
    }
  }
}

// ============================================================
// Type inference (for local variables without explicit types)
// ============================================================

export function inferType(
  expr: Expression,
  varTypes: Map<string, SkittlesType>
): SkittlesType | undefined {
  switch (expr.kind) {
    case "number-literal":
      return { kind: "uint256" as SkittlesTypeKind };
    case "string-literal":
      return { kind: "string" as SkittlesTypeKind };
    case "boolean-literal":
      return { kind: "bool" as SkittlesTypeKind };
    case "identifier":
      if (expr.name === "self")
        return { kind: "address" as SkittlesTypeKind };
      return varTypes.get(expr.name);
    case "property-access":
      if (expr.object.kind === "identifier") {
        if (expr.object.name === "this") {
          return varTypes.get(expr.property);
        }
        if (expr.object.name === "msg") {
          if (expr.property === "sender")
            return { kind: "address" as SkittlesTypeKind };
          if (expr.property === "value")
            return { kind: "uint256" as SkittlesTypeKind };
          if (expr.property === "data")
            return { kind: "bytes" as SkittlesTypeKind };
          if (expr.property === "sig")
            return { kind: "bytes32" as SkittlesTypeKind };
        }
        if (expr.object.name === "block") {
          if (expr.property === "coinbase")
            return { kind: "address" as SkittlesTypeKind };
          return { kind: "uint256" as SkittlesTypeKind };
        }
        if (expr.object.name === "tx") {
          if (expr.property === "origin")
            return { kind: "address" as SkittlesTypeKind };
          return { kind: "uint256" as SkittlesTypeKind };
        }
      }
      return undefined;
    case "element-access": {
      const objType = inferType(expr.object, varTypes);
      if (objType?.kind === ("mapping" as SkittlesTypeKind))
        return objType.valueType;
      if (objType?.kind === ("array" as SkittlesTypeKind))
        return objType.valueType;
      return undefined;
    }
    case "binary":
      if (
        ["==", "!=", "<", ">", "<=", ">=", "&&", "||"].includes(
          expr.operator
        )
      ) {
        return { kind: "bool" as SkittlesTypeKind };
      }
      return inferType(expr.left, varTypes);
    case "unary":
      if (expr.operator === "!")
        return { kind: "bool" as SkittlesTypeKind };
      return inferType(expr.operand, varTypes);
    case "call":
      if (expr.callee.kind === "identifier") {
        if (STRING_RETURNING_HELPERS.has(expr.callee.name)) {
          return { kind: "string" as SkittlesTypeKind };
        }
        if (expr.callee.name === "_startsWith" || expr.callee.name === "_endsWith") {
          return { kind: "bool" as SkittlesTypeKind };
        }
        if (expr.callee.name === "_split") {
          return { kind: "array" as SkittlesTypeKind, valueType: { kind: "string" as SkittlesTypeKind } };
        }
      }
      return undefined;
    default:
      return undefined;
  }
}

// ============================================================
// Helpers
// ============================================================

function collectContractInterfaceTypeRefs(type: SkittlesType, refs: Set<string>): void {
  if (type.kind === ("contract-interface" as SkittlesTypeKind) && type.structName) {
    refs.add(type.structName);
  }
  if (type.keyType) collectContractInterfaceTypeRefs(type.keyType, refs);
  if (type.valueType) collectContractInterfaceTypeRefs(type.valueType, refs);
}

function collectBodyContractInterfaceRefs(stmts: Statement[], refs: Set<string>): void {
  for (const stmt of stmts) {
    if (stmt.kind === "variable-declaration" && stmt.type) {
      collectContractInterfaceTypeRefs(stmt.type, refs);
    }
    if (stmt.kind === "if") {
      collectBodyContractInterfaceRefs(stmt.thenBody, refs);
      if (stmt.elseBody) collectBodyContractInterfaceRefs(stmt.elseBody, refs);
    }
    if (stmt.kind === "for" || stmt.kind === "while" || stmt.kind === "do-while") {
      collectBodyContractInterfaceRefs(stmt.body, refs);
    }
    if (stmt.kind === "switch") {
      for (const c of stmt.cases) collectBodyContractInterfaceRefs(c.body, refs);
    }
    if (stmt.kind === "try-catch") {
      collectBodyContractInterfaceRefs(stmt.successBody, refs);
      collectBodyContractInterfaceRefs(stmt.catchBody, refs);
    }
  }
}

function isStateAccess(expr: Expression): boolean {
  if (
    expr.kind === "property-access" &&
    expr.object.kind === "identifier" &&
    expr.object.name === "this"
  ) {
    return true;
  }
  if (expr.kind === "element-access") {
    return isStateAccess(expr.object);
  }
  return false;
}

function isExternalContractCall(expr: { callee: Expression }, varTypes: Map<string, SkittlesType>): boolean {
  if (
    expr.callee.kind === "property-access" &&
    expr.callee.object.kind === "property-access" &&
    expr.callee.object.object.kind === "identifier" &&
    expr.callee.object.object.name === "this"
  ) {
    const propName = expr.callee.object.property;
    const propType = varTypes.get(propName);
    if (propType && propType.kind === ("contract-interface" as SkittlesTypeKind)) {
      return true;
    }
  }
  return false;
}

function isExternalContractCallOnLocal(expr: { callee: Expression }, localVarTypes: Map<string, SkittlesType>): boolean {
  if (
    expr.callee.kind === "property-access" &&
    expr.callee.object.kind === "identifier" &&
    expr.callee.object.name !== "this"
  ) {
    const varName = expr.callee.object.name;
    const varType = localVarTypes.get(varName);
    if (varType && varType.kind === ("contract-interface" as SkittlesTypeKind)) {
      return true;
    }
  }
  return false;
}

/**
 * Look up the stateMutability of the called method for an external contract call.
 * Returns the method's stateMutability if found, or undefined if not resolvable.
 */
function getExternalCallMethodMutability(
  expr: { callee: Expression },
  varTypes?: Map<string, SkittlesType>,
  localVarTypes?: Map<string, SkittlesType>
): StateMutability | undefined {
  if (expr.callee.kind !== "property-access") return undefined;
  const methodName = expr.callee.property;

  // Resolve the interface name from state variable (this.token.method())
  let ifaceName: string | undefined;
  if (
    expr.callee.object.kind === "property-access" &&
    expr.callee.object.object.kind === "identifier" &&
    expr.callee.object.object.name === "this" &&
    varTypes
  ) {
    const propType = varTypes.get(expr.callee.object.property);
    if (propType?.kind === ("contract-interface" as SkittlesTypeKind)) {
      ifaceName = propType.structName;
    }
  }

  // Resolve from local variable (token.method())
  if (
    !ifaceName &&
    expr.callee.object.kind === "identifier" &&
    expr.callee.object.name !== "this" &&
    localVarTypes
  ) {
    const varType = localVarTypes.get(expr.callee.object.name);
    if (varType?.kind === ("contract-interface" as SkittlesTypeKind)) {
      ifaceName = varType.structName;
    }
  }

  if (!ifaceName) return undefined;
  const iface = _knownContractInterfaceMap.get(ifaceName);
  if (!iface) return undefined;
  const method = iface.functions.find(f => f.name === methodName);
  return method?.stateMutability;
}

function isStateMutatingCall(expr: { callee: Expression }): boolean {
  if (expr.callee.kind !== "property-access") return false;
  const method = expr.callee.property;
  if (!["push", "pop", "remove", "splice", "reverse"].includes(method)) return false;
  return isStateAccess(expr.callee.object);
}

// ============================================================
// Array method helpers
// ============================================================

function isArrayLikeReceiver(node: ts.Expression): boolean {
  if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword) {
    const name = node.name.text;
    const type = _currentVarTypes.get(name);
    return type?.kind === ("array" as SkittlesTypeKind);
  }
  return false;
}

function resolveArrayElementType(node: ts.Expression): SkittlesType | undefined {
  if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword) {
    const name = node.name.text;
    const type = _currentVarTypes.get(name);
    if (type?.kind === ("array" as SkittlesTypeKind)) {
      return type.valueType;
    }
  }
  return undefined;
}

function resolveSpreadElementType(node: ts.Expression): SkittlesType | undefined {
  // this.arr case (storage array)
  if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword) {
    const name = node.name.text;
    const type = _currentVarTypes.get(name);
    if (type?.kind === ("array" as SkittlesTypeKind)) return type.valueType;
  }
  // function parameter case
  if (ts.isIdentifier(node)) {
    const type = _currentParamTypes.get(node.text);
    if (type?.kind === ("array" as SkittlesTypeKind)) return type.valueType;
  }
  return undefined;
}

function typeToSolidityName(type: SkittlesType): string {
  switch (type.kind) {
    case "uint256" as SkittlesTypeKind: return "uint256";
    case "int256" as SkittlesTypeKind: return "int256";
    case "address" as SkittlesTypeKind: return "address";
    case "bool" as SkittlesTypeKind: return "bool";
    case "string" as SkittlesTypeKind: return "string";
    case "bytes32" as SkittlesTypeKind: return "bytes32";
    case "bytes" as SkittlesTypeKind: return "bytes";
    case "struct" as SkittlesTypeKind: return type.structName ?? "UnknownStruct";
    case "enum" as SkittlesTypeKind: return type.structName ?? "UnknownEnum";
    case "contract-interface" as SkittlesTypeKind: return type.structName ?? "UnknownInterface";
    case "array" as SkittlesTypeKind: return `${typeToSolidityName(type.valueType!)}[]`;
    default: return "uint256";
  }
}

function getArrayHelperSuffix(elementType: SkittlesType | undefined): string {
  if (!elementType) return "uint256";
  return identifierSafeType(elementType);
}

function identifierSafeType(type: SkittlesType): string {
  switch (type.kind) {
    case "uint256" as SkittlesTypeKind: return "uint256";
    case "int256" as SkittlesTypeKind: return "int256";
    case "address" as SkittlesTypeKind: return "address";
    case "bool" as SkittlesTypeKind: return "bool";
    case "string" as SkittlesTypeKind: return "string";
    case "bytes32" as SkittlesTypeKind: return "bytes32";
    case "bytes" as SkittlesTypeKind: return "bytes";
    case "struct" as SkittlesTypeKind: return type.structName ?? "UnknownStruct";
    case "enum" as SkittlesTypeKind: return type.structName ?? "UnknownEnum";
    case "contract-interface" as SkittlesTypeKind: return type.structName ?? "UnknownInterface";
    case "array" as SkittlesTypeKind: return `arr_${identifierSafeType(type.valueType!)}`;
    default: return "uint256";
  }
}

// IR construction helpers for generated array method code
function mkId(name: string): Expression { return { kind: "identifier", name }; }
function mkNum(value: string): Expression { return { kind: "number-literal", value }; }
function mkProp(obj: Expression, prop: string): Expression { return { kind: "property-access", object: obj, property: prop }; }
function mkElem(obj: Expression, index: Expression): Expression { return { kind: "element-access", object: obj, index }; }
function mkBin(left: Expression, op: string, right: Expression): Expression { return { kind: "binary", operator: op, left, right }; }
function mkAssign(target: Expression, value: Expression): Expression { return { kind: "assignment", operator: "=", target, value }; }
function mkIncr(name: string): Expression { return { kind: "unary", operator: "++", operand: mkId(name), prefix: false }; }
function mkDecr(name: string): Expression { return { kind: "unary", operator: "--", operand: mkId(name), prefix: false }; }
function mkVarDecl(name: string, type: SkittlesType | undefined, init?: Expression): Statement {
  return { kind: "variable-declaration", name, type: type, initializer: init };
}
function mkExprStmt(expr: Expression): Statement { return { kind: "expression", expression: expr }; }
function mkReturn(value?: Expression): Statement { return { kind: "return", value }; }
function mkIf(cond: Expression, thenBody: Statement[], elseBody?: Statement[]): Statement {
  return { kind: "if", condition: cond, thenBody, elseBody };
}
const UINT256_TYPE: SkittlesType = { kind: "uint256" as SkittlesTypeKind };
const BOOL_TYPE: SkittlesType = { kind: "bool" as SkittlesTypeKind };

const BUILTIN_IDENTIFIERS = new Set(["msg", "block", "tx", "self", "type", "abi", "this", "super"]);

function collectBareIdentifiers(expr: Expression): Set<string> {
  const ids = new Set<string>();
  function walkExpr(e: Expression) {
    switch (e.kind) {
      case "identifier": ids.add(e.name); break;
      case "binary": walkExpr(e.left); walkExpr(e.right); break;
      case "unary": walkExpr(e.operand); break;
      case "call": walkExpr(e.callee); e.args.forEach(walkExpr); break;
      case "property-access": walkExpr(e.object); break;
      case "element-access": walkExpr(e.object); walkExpr(e.index); break;
      case "assignment": walkExpr(e.target); walkExpr(e.value); break;
      case "conditional": walkExpr(e.condition); walkExpr(e.whenTrue); walkExpr(e.whenFalse); break;
      case "new": e.args.forEach(walkExpr); break;
      case "object-literal": e.properties.forEach(p => walkExpr(p.value)); break;
      case "tuple-literal": e.elements.forEach(walkExpr); break;
    }
  }
  walkExpr(expr);
  return ids;
}

function collectBareIdentifiersFromStmts(stmts: Statement[]): Set<string> {
  const ids = new Set<string>();
  function walkExpr(e: Expression) {
    for (const id of collectBareIdentifiers(e)) ids.add(id);
  }
  function walkStmts(ss: Statement[]) {
    for (const s of ss) walkStmt(s);
  }
  function walkStmt(s: Statement) {
    switch (s.kind) {
      case "expression": walkExpr(s.expression); break;
      case "return": if (s.value) walkExpr(s.value); break;
      case "variable-declaration": if (s.initializer) walkExpr(s.initializer); break;
      case "if": walkExpr(s.condition); walkStmts(s.thenBody); if (s.elseBody) walkStmts(s.elseBody); break;
      case "for": {
        if (s.initializer) walkStmt(s.initializer);
        if (s.condition) walkExpr(s.condition);
        if (s.incrementor) walkExpr(s.incrementor);
        walkStmts(s.body);
        break;
      }
      case "while": walkExpr(s.condition); walkStmts(s.body); break;
      case "do-while": walkExpr(s.condition); walkStmts(s.body); break;
      case "emit": s.args.forEach(walkExpr); break;
      case "revert": if (s.message) walkExpr(s.message); if (s.customErrorArgs) s.customErrorArgs.forEach(walkExpr); break;
      case "delete": walkExpr(s.target); break;
      case "switch": walkExpr(s.discriminant); s.cases.forEach(c => { if (c.value) walkExpr(c.value); walkStmts(c.body); }); break;
      case "try-catch": walkExpr(s.call); walkStmts(s.successBody); walkStmts(s.catchBody); break;
      case "console-log": s.args.forEach(walkExpr); break;
    }
  }
  walkStmts(stmts);
  return ids;
}

function validateCallbackScope(expr: Expression | null, stmts: Statement[] | undefined, allowedNames: Set<string>, methodName: string): void {
  const ids = expr ? collectBareIdentifiers(expr) : stmts ? collectBareIdentifiersFromStmts(stmts) : new Set<string>();
  for (const id of ids) {
    if (BUILTIN_IDENTIFIERS.has(id)) continue;
    if (allowedNames.has(id)) continue;
    throw new Error(
      `Array .${methodName}() callback references '${id}', which is not accessible in the generated helper. ` +
      `Callbacks can only reference their parameters, literals, and state variables (this.*).`
    );
  }
}

function mkForLoop(
  indexName: string,
  arrayExpr: Expression,
  body: Statement[]
): Statement {
  return {
    kind: "for",
    initializer: { kind: "variable-declaration", name: indexName, type: UINT256_TYPE, initializer: mkNum("0") },
    condition: mkBin(mkId(indexName), "<", mkProp(arrayExpr, "length")),
    incrementor: mkIncr(indexName),
    body,
  };
}

function parseArrowCallback(
  node: ts.Expression,
  paramTypes?: { first?: SkittlesType; second?: SkittlesType }
): { paramName: string; secondParamName?: string; bodyExpr?: Expression; bodyStmts?: Statement[] } | null {
  if (!ts.isArrowFunction(node)) return null;
  if (node.parameters.length < 1) return null;
  const paramName = ts.isIdentifier(node.parameters[0].name) ? node.parameters[0].name.text : "_item";
  const secondParamName = node.parameters.length >= 2 && ts.isIdentifier(node.parameters[1].name)
    ? node.parameters[1].name.text : undefined;

  if (paramName.startsWith("__sk_")) {
    throw new Error(`Callback parameter name '${paramName}' uses the reserved prefix '__sk_'. Names starting with '__sk_' are reserved for compiler-generated variables.`);
  }
  if (secondParamName?.startsWith("__sk_")) {
    throw new Error(`Callback parameter name '${secondParamName}' uses the reserved prefix '__sk_'. Names starting with '__sk_' are reserved for compiler-generated variables.`);
  }

  if (ts.isBlock(node.body)) {
    const stmts = node.body.statements;
    if (stmts.length === 1 && ts.isReturnStatement(stmts[0]) && stmts[0].expression) {
      return { paramName, secondParamName, bodyExpr: parseExpression(stmts[0].expression) };
    }
    const varTypes = new Map(_currentVarTypes);
    if (paramTypes?.first) varTypes.set(paramName, paramTypes.first);
    if (paramTypes?.second && secondParamName) varTypes.set(secondParamName, paramTypes.second);
    const parsedStmts: Statement[] = [];
    for (const s of stmts) {
      parsedStmts.push(parseStatement(s, varTypes, _currentEventNames));
    }
    return { paramName, secondParamName, bodyStmts: parsedStmts };
  }
  return { paramName, secondParamName, bodyExpr: parseExpression(node.body as ts.Expression) };
}

function generateFilterHelper(
  arrayExpr: Expression,
  elementType: SkittlesType | undefined,
  paramName: string,
  condExpr: Expression
): SkittlesFunction {
  const helperName = `_filter_${_arrayMethodCounter++}`;
  const elemType = elementType ?? UINT256_TYPE;
  const arrType: SkittlesType = { kind: "array" as SkittlesTypeKind, valueType: elemType };
  const elemTypeName = typeToSolidityName(elemType);
  const body: Statement[] = [
    mkVarDecl("__sk_count", UINT256_TYPE, mkNum("0")),
    mkForLoop("__sk_i", arrayExpr, [
      mkVarDecl(paramName, elemType, mkElem(arrayExpr, mkId("__sk_i"))),
      mkIf(condExpr, [mkExprStmt(mkIncr("__sk_count"))]),
    ]),
    mkVarDecl("__sk_result", arrType, { kind: "new", callee: `${elemTypeName}[]`, args: [mkId("__sk_count")] }),
    mkVarDecl("__sk_j", UINT256_TYPE, mkNum("0")),
    mkForLoop("__sk_i2", arrayExpr, [
      mkVarDecl(paramName, elemType, mkElem(arrayExpr, mkId("__sk_i2"))),
      mkIf(condExpr, [
        mkExprStmt(mkAssign(mkElem(mkId("__sk_result"), mkId("__sk_j")), mkElem(arrayExpr, mkId("__sk_i2")))),
        mkExprStmt(mkIncr("__sk_j")),
      ]),
    ]),
    mkReturn(mkId("__sk_result")),
  ];
  return { name: helperName, parameters: [], returnType: arrType, visibility: "private", stateMutability: inferStateMutability(body, _currentVarTypes), isVirtual: false, isOverride: false, body };
}

function generateMapHelper(
  arrayExpr: Expression,
  elementType: SkittlesType | undefined,
  paramName: string,
  transformExpr: Expression,
  resultElementType: SkittlesType | undefined
): SkittlesFunction {
  const helperName = `_map_${_arrayMethodCounter++}`;
  const elemType = elementType ?? UINT256_TYPE;
  const resultElemType = resultElementType ?? UINT256_TYPE;
  const arrType: SkittlesType = { kind: "array" as SkittlesTypeKind, valueType: resultElemType };
  const resultTypeName = typeToSolidityName(resultElemType);
  const body: Statement[] = [
    mkVarDecl("__sk_result", arrType, { kind: "new", callee: `${resultTypeName}[]`, args: [mkProp(arrayExpr, "length")] }),
    mkForLoop("__sk_i", arrayExpr, [
      mkVarDecl(paramName, elemType, mkElem(arrayExpr, mkId("__sk_i"))),
      mkExprStmt(mkAssign(mkElem(mkId("__sk_result"), mkId("__sk_i")), transformExpr)),
    ]),
    mkReturn(mkId("__sk_result")),
  ];
  return { name: helperName, parameters: [], returnType: arrType, visibility: "private", stateMutability: inferStateMutability(body, _currentVarTypes), isVirtual: false, isOverride: false, body };
}

function generateSomeEveryHelper(
  method: "some" | "every",
  arrayExpr: Expression,
  elementType: SkittlesType | undefined,
  paramName: string,
  condExpr: Expression
): SkittlesFunction {
  const helperName = `_${method}_${_arrayMethodCounter++}`;
  const elemType = elementType ?? UINT256_TYPE;
  const isSome = method === "some";
  const body: Statement[] = [
    mkForLoop("__sk_i", arrayExpr, [
      mkVarDecl(paramName, elemType, mkElem(arrayExpr, mkId("__sk_i"))),
      mkIf(isSome ? condExpr : { kind: "unary", operator: "!", operand: condExpr, prefix: true }, [
        mkReturn(isSome ? { kind: "boolean-literal", value: true } : { kind: "boolean-literal", value: false }),
      ]),
    ]),
    mkReturn(isSome ? { kind: "boolean-literal", value: false } : { kind: "boolean-literal", value: true }),
  ];
  return { name: helperName, parameters: [], returnType: BOOL_TYPE, visibility: "private", stateMutability: inferStateMutability(body, _currentVarTypes), isVirtual: false, isOverride: false, body };
}

function generateFindHelper(
  arrayExpr: Expression,
  elementType: SkittlesType | undefined,
  paramName: string,
  condExpr: Expression
): SkittlesFunction {
  const helperName = `_find_${_arrayMethodCounter++}`;
  const elemType = elementType ?? UINT256_TYPE;
  const body: Statement[] = [
    mkForLoop("__sk_i", arrayExpr, [
      mkVarDecl(paramName, elemType, mkElem(arrayExpr, mkId("__sk_i"))),
      mkIf(condExpr, [mkReturn(mkId(paramName))]),
    ]),
    { kind: "revert", message: { kind: "string-literal", value: "not found" } },
  ];
  return { name: helperName, parameters: [], returnType: elemType, visibility: "private", stateMutability: inferStateMutability(body, _currentVarTypes), isVirtual: false, isOverride: false, body };
}

function generateFindIndexHelper(
  arrayExpr: Expression,
  elementType: SkittlesType | undefined,
  paramName: string,
  condExpr: Expression
): SkittlesFunction {
  const helperName = `_findIndex_${_arrayMethodCounter++}`;
  const elemType = elementType ?? UINT256_TYPE;
  const body: Statement[] = [
    mkForLoop("__sk_i", arrayExpr, [
      mkVarDecl(paramName, elemType, mkElem(arrayExpr, mkId("__sk_i"))),
      mkIf(condExpr, [mkReturn(mkId("__sk_i"))]),
    ]),
    mkReturn(mkProp(mkId("type(uint256)"), "max")),
  ];
  return { name: helperName, parameters: [], returnType: UINT256_TYPE, visibility: "private", stateMutability: inferStateMutability(body, _currentVarTypes), isVirtual: false, isOverride: false, body };
}

function generateReduceHelper(
  arrayExpr: Expression,
  elementType: SkittlesType | undefined,
  accParamName: string,
  itemParamName: string,
  bodyExpr: Expression,
  initialValue: Expression,
  accType: SkittlesType | undefined
): SkittlesFunction {
  const helperName = `_reduce_${_arrayMethodCounter++}`;
  const elemType = elementType ?? UINT256_TYPE;
  const returnType = accType ?? UINT256_TYPE;
  const body: Statement[] = [
    mkVarDecl("__sk_acc", returnType, initialValue),
    mkForLoop("__sk_i", arrayExpr, [
      mkVarDecl(accParamName, returnType, mkId("__sk_acc")),
      mkVarDecl(itemParamName, elemType, mkElem(arrayExpr, mkId("__sk_i"))),
      mkExprStmt(mkAssign(mkId("__sk_acc"), bodyExpr)),
    ]),
    mkReturn(mkId("__sk_acc")),
  ];
  return { name: helperName, parameters: [], returnType, visibility: "private", stateMutability: inferStateMutability(body, _currentVarTypes), isVirtual: false, isOverride: false, body };
}

/**
 * Check if a TypeScript AST expression represents a mapping-like receiver
 * (this.xxx where xxx is a mapping state variable, or this.xxx[key] for nested mappings).
 * Used to detect Map method calls (.get, .set, .has, .delete) that should be
 * transformed into Solidity mapping operations.
 */
function isMappingLikeReceiver(node: ts.Expression): boolean {
  if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword) {
    const name = node.name.text;
    const type = _currentVarTypes.get(name);
    return type?.kind === ("mapping" as SkittlesTypeKind);
  }
  if (ts.isElementAccessExpression(node)) {
    return isMappingLikeReceiver(node.expression);
  }
  return false;
}

/**
 * Resolve the mapping value type for a mapping-like receiver expression.
 * For `this.balances` where balances is `Map<address, number>`, returns the `number` type.
 * For `this.allowances[owner]` where allowances is `Map<address, Map<address, number>>`,
 * returns the inner `number` type.
 */
function resolveMappingValueType(node: ts.Expression): SkittlesType | undefined {
  if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword) {
    const name = node.name.text;
    const type = _currentVarTypes.get(name);
    if (type?.kind === ("mapping" as SkittlesTypeKind)) {
      return type.valueType;
    }
    return undefined;
  }
  if (ts.isElementAccessExpression(node)) {
    const parentValueType = resolveMappingValueType(node.expression);
    if (parentValueType?.kind === ("mapping" as SkittlesTypeKind)) {
      return parentValueType.valueType;
    }
    return undefined;
  }
  return undefined;
}

/**
 * Return the default-value expression for a given Solidity type, used by Map.has().
 * Returns null for types that have no meaningful default comparison (structs, mappings).
 */
function defaultValueForType(type: SkittlesType | undefined): Expression | null {
  if (!type) return null;
  switch (type.kind) {
    case "uint256" as SkittlesTypeKind:
    case "int256" as SkittlesTypeKind:
      return { kind: "number-literal", value: "0" };
    case "bool" as SkittlesTypeKind:
      return { kind: "boolean-literal", value: false };
    case "address" as SkittlesTypeKind:
      return { kind: "identifier", name: "address(0)" };
    default:
      return null;
  }
}

/**
 * Check if the receiver of a property-access is `this` or a contract-interface typed variable.
 * Used to distinguish `addr.transfer(amount)` (ETH transfer) from
 * `this.transfer(...)` or `token.transfer(...)` (contract method calls).
 */
function isContractInterfaceReceiver(
  receiver: Expression,
  varTypes?: Map<string, SkittlesType>,
  localVarTypes?: Map<string, SkittlesType>
): boolean {
  // this.transfer(...) is an internal contract call
  if (receiver.kind === "identifier" && receiver.name === "this") return true;
  // this.token.transfer(...) where token is a contract-interface state variable
  if (
    receiver.kind === "property-access" &&
    receiver.object.kind === "identifier" &&
    receiver.object.name === "this"
  ) {
    const propType = varTypes?.get(receiver.property);
    if (propType && propType.kind === ("contract-interface" as SkittlesTypeKind)) return true;
  }
  // token.transfer(...) where token is a contract-interface local/param
  if (receiver.kind === "identifier") {
    const localType = localVarTypes?.get(receiver.name);
    if (localType && localType.kind === ("contract-interface" as SkittlesTypeKind)) return true;
    const stateType = varTypes?.get(receiver.name);
    if (stateType && stateType.kind === ("contract-interface" as SkittlesTypeKind)) return true;
  }
  return false;
}

function getVisibility(
  modifiers: readonly ts.ModifierLike[] | undefined
): Visibility {
  if (!modifiers) return "public";
  for (const mod of modifiers) {
    if (mod.kind === ts.SyntaxKind.PrivateKeyword) return "private";
    if (mod.kind === ts.SyntaxKind.ProtectedKeyword) return "internal";
    if (mod.kind === ts.SyntaxKind.PublicKeyword) return "public";
  }
  return "public";
}

function hasModifier(
  modifiers: readonly ts.ModifierLike[] | undefined,
  kind: ts.SyntaxKind
): boolean {
  if (!modifiers) return false;
  return modifiers.some((mod) => mod.kind === kind);
}

function getBinaryOperator(kind: ts.SyntaxKind): string {
  const map: Partial<Record<ts.SyntaxKind, string>> = {
    [ts.SyntaxKind.PlusToken]: "+",
    [ts.SyntaxKind.MinusToken]: "-",
    [ts.SyntaxKind.AsteriskToken]: "*",
    [ts.SyntaxKind.SlashToken]: "/",
    [ts.SyntaxKind.PercentToken]: "%",
    [ts.SyntaxKind.AsteriskAsteriskToken]: "**",
    [ts.SyntaxKind.EqualsEqualsToken]: "==",
    [ts.SyntaxKind.EqualsEqualsEqualsToken]: "==",
    [ts.SyntaxKind.ExclamationEqualsToken]: "!=",
    [ts.SyntaxKind.ExclamationEqualsEqualsToken]: "!=",
    [ts.SyntaxKind.LessThanToken]: "<",
    [ts.SyntaxKind.GreaterThanToken]: ">",
    [ts.SyntaxKind.LessThanEqualsToken]: "<=",
    [ts.SyntaxKind.GreaterThanEqualsToken]: ">=",
    [ts.SyntaxKind.AmpersandAmpersandToken]: "&&",
    [ts.SyntaxKind.BarBarToken]: "||",
    [ts.SyntaxKind.AmpersandToken]: "&",
    [ts.SyntaxKind.BarToken]: "|",
    [ts.SyntaxKind.CaretToken]: "^",
    [ts.SyntaxKind.LessThanLessThanToken]: "<<",
    [ts.SyntaxKind.GreaterThanGreaterThanToken]: ">>",
    [ts.SyntaxKind.EqualsToken]: "=",
    [ts.SyntaxKind.PlusEqualsToken]: "+=",
    [ts.SyntaxKind.MinusEqualsToken]: "-=",
    [ts.SyntaxKind.AsteriskEqualsToken]: "*=",
    [ts.SyntaxKind.SlashEqualsToken]: "/=",
    [ts.SyntaxKind.PercentEqualsToken]: "%=",
    [ts.SyntaxKind.AmpersandEqualsToken]: "&=",
    [ts.SyntaxKind.BarEqualsToken]: "|=",
    [ts.SyntaxKind.CaretEqualsToken]: "^=",
    [ts.SyntaxKind.LessThanLessThanEqualsToken]: "<<=",
    [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken]: ">>=",
  };
  return map[kind] ?? "?";
}

function isAssignmentOperator(kind: ts.SyntaxKind): boolean {
  return [
    ts.SyntaxKind.EqualsToken,
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.SlashEqualsToken,
    ts.SyntaxKind.PercentEqualsToken,
    ts.SyntaxKind.AmpersandEqualsToken,
    ts.SyntaxKind.BarEqualsToken,
    ts.SyntaxKind.CaretEqualsToken,
    ts.SyntaxKind.LessThanLessThanEqualsToken,
    ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ].includes(kind);
}

function getUnaryOperator(kind: ts.SyntaxKind): string {
  const map: Partial<Record<ts.SyntaxKind, string>> = {
    [ts.SyntaxKind.ExclamationToken]: "!",
    [ts.SyntaxKind.MinusToken]: "-",
    [ts.SyntaxKind.PlusToken]: "+",
    [ts.SyntaxKind.PlusPlusToken]: "++",
    [ts.SyntaxKind.MinusMinusToken]: "--",
    [ts.SyntaxKind.TildeToken]: "~",
  };
  return map[kind] ?? "?";
}
