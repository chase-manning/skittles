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
  Statement,
  Expression,
  EmitStatement,
  SwitchCase,
} from "../types/index.ts";

// Module-level registries, populated during parse()
let _knownStructs: Map<string, SkittlesParameter[]> = new Map();
let _knownContractInterfaces: Set<string> = new Set();
let _knownEnums: Set<string> = new Set();
let _knownCustomErrors: Set<string> = new Set();
let _fileConstants: Map<string, Expression> = new Map();

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
  _knownStructs = structs;
  _knownEnums = new Set();
  _knownContractInterfaces = new Set();

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
  _knownEnums = new Set(enums.keys());

  // Second pass: parse interfaces (may reference struct/enum types collected above)
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name) {
      const iface = parseInterfaceAsContractInterface(node);
      contractInterfaces.set(node.name.text, iface);
    }
  });

  const customErrors: Map<string, SkittlesParameter[]> = new Map();

  _knownContractInterfaces = new Set(contractInterfaces.keys());
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
  _knownStructs = new Map();
  _knownEnums = new Set();
  _knownContractInterfaces = new Set();

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

  return { functions, constants };
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

function parseStandaloneFunction(
  node: ts.FunctionDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name = node.name ? node.name.text : "unknown";
  const parameters = node.parameters.map(parseParameter);
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
  const variables: SkittlesVariable[] = [];
  const functions: SkittlesFunction[] = [];
  const events: SkittlesEvent[] = [];
  let ctor: SkittlesConstructor | undefined;
  const inherits: string[] = [];

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

  // Second pass: methods (instance and static), constructor, and arrow function properties
  for (const member of node.members) {
    if (ts.isMethodDeclaration(member)) {
      const isStatic = hasModifier(member.modifiers, ts.SyntaxKind.StaticKeyword);
      const fn = parseMethod(member, varTypes, eventNames);
      // Static methods are internal pure/view helpers
      if (isStatic) {
        fn.visibility = "private";
      }
      functions.push(fn);
    } else if (ts.isConstructorDeclaration(member)) {
      ctor = parseConstructorDecl(member, varTypes, eventNames);
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

  // Inject file level standalone functions as internal helpers
  for (const fn of fileFunctions) {
    // Avoid duplicates if a class method already has the same name
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

  const contractStructs: { name: string; fields: SkittlesParameter[] }[] = [];
  for (const [sName, fields] of knownStructs) {
    contractStructs.push({ name: sName, fields });
  }

  const contractEnums: { name: string; members: string[] }[] = [];
  for (const [eName, members] of knownEnums) {
    contractEnums.push({ name: eName, members });
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
  }
  if (ctor) {
    for (const p of ctor.parameters) collectContractInterfaceTypeRefs(p.type, usedIfaceNames);
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

  return { name, parameters };
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

  return { name, type, visibility, immutable, constant, initialValue };
}

function parseMethod(
  node: ts.MethodDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name =
    node.name && ts.isIdentifier(node.name) ? node.name.text : "unknown";

  const parameters = node.parameters.map(parseParameter);
  const returnType: SkittlesType | null = node.type
    ? parseType(node.type)
    : null;
  const visibility = getVisibility(node.modifiers);
  const body = node.body ? parseBlock(node.body, varTypes, eventNames) : [];
  const stateMutability = inferStateMutability(body, varTypes);

  const isOverride = hasModifier(node.modifiers, ts.SyntaxKind.OverrideKeyword);
  const isVirtual = !isOverride;

  return { name, parameters, returnType, visibility, stateMutability, isVirtual, isOverride, body };
}

function parseGetAccessor(
  node: ts.GetAccessorDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name =
    node.name && ts.isIdentifier(node.name) ? node.name.text : "unknown";

  const parameters: SkittlesParameter[] = [];
  const returnType: SkittlesType | null = node.type
    ? parseType(node.type)
    : null;
  const visibility = getVisibility(node.modifiers);
  const body = node.body ? parseBlock(node.body, varTypes, eventNames) : [];
  const stateMutability = inferStateMutability(body, varTypes);

  const isOverride = hasModifier(node.modifiers, ts.SyntaxKind.OverrideKeyword);
  const isVirtual = !isOverride;

  return { name, parameters, returnType, visibility, stateMutability, isVirtual, isOverride, body };
}

function parseSetAccessor(
  node: ts.SetAccessorDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesFunction {
  const name =
    node.name && ts.isIdentifier(node.name) ? node.name.text : "unknown";

  const parameters = node.parameters.map(parseParameter);
  const returnType: SkittlesType | null = null; // setters don't return
  const visibility = getVisibility(node.modifiers);
  const body = node.body ? parseBlock(node.body, varTypes, eventNames) : [];
  const stateMutability = inferStateMutability(body, varTypes);

  const isOverride = hasModifier(node.modifiers, ts.SyntaxKind.OverrideKeyword);
  const isVirtual = !isOverride;

  return { name, parameters, returnType, visibility, stateMutability, isVirtual, isOverride, body };
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

  const stateMutability = inferStateMutability(body, varTypes);
  const isOverride = hasModifier(node.modifiers, ts.SyntaxKind.OverrideKeyword);
  const isVirtual = !isOverride;

  return { name, parameters, returnType, visibility, stateMutability, isVirtual, isOverride, body };
}

function parseConstructorDecl(
  node: ts.ConstructorDeclaration,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string>
): SkittlesConstructor {
  const parameters = node.parameters.map(parseParameter);
  const body = node.body ? parseBlock(node.body, varTypes, eventNames) : [];
  return { parameters, body };
}

function parseParameter(node: ts.ParameterDeclaration): SkittlesParameter {
  const name = ts.isIdentifier(node.name) ? node.name.text : "unknown";
  const type: SkittlesType = node.type
    ? parseType(node.type)
    : { kind: "uint256" as SkittlesTypeKind };
  return { name, type };
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
    return {
      kind: "property-access",
      object: parseExpression(node.expression),
      property: node.name.text,
    };
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

    return {
      kind: "binary",
      operator,
      left: parseExpression(node.left),
      right: parseExpression(node.right),
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
    return {
      kind: "call",
      callee: parseExpression(node.expression),
      args: node.arguments.map(parseExpression),
    };
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

    return { kind: "variable-declaration", name, type, initializer };
  }

  if (ts.isExpressionStatement(node)) {
    const emitStmt = tryParseEmitStatement(node.expression, eventNames);
    if (emitStmt) return emitStmt;

    // Detect delete expressions: `delete this.mapping[key]`
    if (ts.isDeleteExpression(node.expression)) {
      return { kind: "delete", target: parseExpression(node.expression.expression) };
    }

    return { kind: "expression", expression: parseExpression(node.expression) };
  }

  if (ts.isIfStatement(node)) {
    const condition = parseExpression(node.expression);
    const thenBody = parseBlock(node.thenStatement, varTypes, eventNames);
    const elseBody = node.elseStatement
      ? parseBlock(node.elseStatement, varTypes, eventNames)
      : undefined;
    return { kind: "if", condition, thenBody, elseBody };
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
    };
  }

  if (ts.isWhileStatement(node)) {
    return {
      kind: "while",
      condition: parseExpression(node.expression),
      body: parseBlock(node.statement, varTypes, eventNames),
    };
  }

  if (ts.isDoStatement(node)) {
    return {
      kind: "do-while",
      condition: parseExpression(node.expression),
      body: parseBlock(node.statement, varTypes, eventNames),
    };
  }

  if (node.kind === ts.SyntaxKind.BreakStatement) {
    return { kind: "break" };
  }

  if (node.kind === ts.SyntaxKind.ContinueStatement) {
    return { kind: "continue" };
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
    };
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
    return { kind: "switch", discriminant, cases };
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
        return { kind: "revert", customError: errorName, customErrorArgs: args };
      }

      let message: Expression | undefined;
      if (
        node.expression.arguments &&
        node.expression.arguments.length > 0
      ) {
        message = parseExpression(node.expression.arguments[0]);
      }
      return { kind: "revert", message };
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
          return { kind: "revert", customError: errorName, customErrorArgs: args };
        }
      }
    }

    return { kind: "revert" };
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
      return node.declarationList.declarations.map((decl) => {
        const name = ts.isIdentifier(decl.name) ? decl.name.text : "unknown";
        const explicitType = decl.type ? parseType(decl.type) : undefined;
        const initializer = decl.initializer
          ? parseExpression(decl.initializer)
          : undefined;
        const type =
          explicitType || (initializer ? inferType(initializer, varTypes) : undefined);
        return { kind: "variable-declaration" as const, name, type, initializer };
      });
    }

    // Array destructuring: const [a, b, c] = [7, 8, 9]
    const decl = node.declarationList.declarations[0];
    if (decl.name && ts.isArrayBindingPattern(decl.name) && decl.initializer) {
      return parseArrayDestructuring(decl.name, decl.initializer, varTypes);
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

export function inferStateMutability(body: Statement[], varTypes?: Map<string, SkittlesType>): "pure" | "view" | "nonpayable" | "payable" {
  let readsState = false;
  let writesState = false;
  let usesMsgValue = false;

  const thisCallCallees = new Set<Expression>();

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
      if (expr.kind === "call" && varTypes && isExternalContractCall(expr, varTypes)) {
        writesState = true;
      }
    },
    (stmt) => {
      if (stmt.kind === "emit") {
        writesState = true;
      }
      if (stmt.kind === "delete" && isStateAccess(stmt.target)) {
        writesState = true;
      }
    }
  );

  if (usesMsgValue) return "payable";
  if (writesState) return "nonpayable";
  if (readsState) return "view";
  return "pure";
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
      return undefined;
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

function isStateMutatingCall(expr: { callee: Expression }): boolean {
  if (expr.callee.kind !== "property-access") return false;
  const method = expr.callee.property;
  if (!["push", "pop"].includes(method)) return false;
  return isStateAccess(expr.callee.object);
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
