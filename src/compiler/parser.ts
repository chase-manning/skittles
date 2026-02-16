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
  Visibility,
  Statement,
  Expression,
  EmitStatement,
} from "../types";

// ============================================================
// Main entry
// ============================================================

export function parse(source: string, filePath: string): SkittlesContract[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );

  const contracts: SkittlesContract[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isClassDeclaration(node) && node.name) {
      contracts.push(parseClass(node, filePath));
    }
  });

  return contracts;
}

// ============================================================
// Class level parsing
// ============================================================

function parseClass(
  node: ts.ClassDeclaration,
  filePath: string
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
    }
  }

  // First pass: collect state variables and events
  for (const member of node.members) {
    if (ts.isPropertyDeclaration(member)) {
      const event = tryParseEvent(member);
      if (event) {
        events.push(event);
      } else {
        variables.push(parseProperty(member));
      }
    }
  }

  const varTypes = new Map<string, SkittlesType>();
  for (const v of variables) {
    varTypes.set(v.name, v.type);
  }

  const eventNames = new Set(events.map((e) => e.name));

  // Second pass: methods and constructor
  for (const member of node.members) {
    if (ts.isMethodDeclaration(member)) {
      functions.push(parseMethod(member, varTypes, eventNames));
    } else if (ts.isConstructorDeclaration(member)) {
      ctor = parseConstructorDecl(member, varTypes, eventNames);
    }
  }

  // Third pass: propagate state mutability through call chains.
  // If function A calls this.B(), and B is nonpayable, then A is also nonpayable.
  propagateStateMutability(functions);

  return {
    name,
    sourcePath: filePath,
    variables,
    functions,
    events,
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
  const immutable = hasModifier(node.modifiers, ts.SyntaxKind.ReadonlyKeyword);

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

  return { name, type, visibility, immutable, initialValue };
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
  const stateMutability = inferStateMutability(body);

  return { name, parameters, returnType, visibility, stateMutability, body };
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
      name === "Record" &&
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

    throw new Error(`Unsupported type reference: "${name}". Skittles supports number, string, boolean, address, bytes, Record<K,V>, and T[].`);
  }

  if (ts.isArrayTypeNode(node)) {
    return {
      kind: "array" as SkittlesTypeKind,
      valueType: parseType(node.elementType),
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
    return { kind: "identifier", name: node.text };
  }

  if (node.kind === ts.SyntaxKind.ThisKeyword) {
    return { kind: "identifier", name: "this" };
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

  if (ts.isConditionalExpression(node)) {
    return {
      kind: "conditional",
      condition: parseExpression(node.condition),
      whenTrue: parseExpression(node.whenTrue),
      whenFalse: parseExpression(node.whenFalse),
    };
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

  if (ts.isThrowStatement(node)) {
    let message: Expression | undefined;
    if (node.expression && ts.isNewExpression(node.expression)) {
      if (
        node.expression.arguments &&
        node.expression.arguments.length > 0
      ) {
        message = parseExpression(node.expression.arguments[0]);
      }
    }
    return { kind: "revert", message };
  }

  throw new Error(`Unsupported statement: ${ts.SyntaxKind[node.kind]}`);
}

function parseBlock(
  node: ts.Statement,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string> = new Set()
): Statement[] {
  if (ts.isBlock(node)) {
    return node.statements.map((s) => parseStatement(s, varTypes, eventNames));
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
      case "emit":
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

export function inferStateMutability(body: Statement[]): "pure" | "view" | "nonpayable" | "payable" {
  let readsState = false;
  let writesState = false;
  let usesMsgValue = false;

  walkStatements(
    body,
    (expr) => {
      if (expr.kind === "property-access") {
        if (expr.object.kind === "identifier" && expr.object.name === "this") {
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
    },
    (stmt) => {
      if (stmt.kind === "emit") {
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
        }
        if (expr.object.name === "block") {
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
    [ts.SyntaxKind.EqualsToken]: "=",
    [ts.SyntaxKind.PlusEqualsToken]: "+=",
    [ts.SyntaxKind.MinusEqualsToken]: "-=",
    [ts.SyntaxKind.AsteriskEqualsToken]: "*=",
    [ts.SyntaxKind.SlashEqualsToken]: "/=",
    [ts.SyntaxKind.PercentEqualsToken]: "%=",
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
