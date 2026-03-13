import ts from "typescript";

import {
  ADDRESS_LITERAL_RE,
  type Expression,
  type SkittlesParameter,
  type SkittlesType,
  SkittlesTypeKind,
  type Statement,
  type Visibility,
} from "../types/index.ts";
import { ctx } from "./parser-context.ts";

export function getSourceLine(node: ts.Node): number | undefined {
  if (!ctx.currentSourceFile) return undefined;
  return (
    ctx.currentSourceFile.getLineAndCharacterOfPosition(node.getStart()).line +
    1
  ); // 1-based
}

export function setupStringTracking(
  parameters: SkittlesParameter[],
  varTypes: Map<string, SkittlesType>
) {
  ctx.currentVarTypes = varTypes;
  ctx.currentStringNames = new Set();
  ctx.currentParamTypes = new Map();
  for (const param of parameters) {
    if (param.type.kind === SkittlesTypeKind.String) {
      ctx.currentStringNames.add(param.name);
    }
    ctx.currentParamTypes.set(param.name, param.type);
  }
}

export function isStringExpr(expr: Expression): boolean {
  if (expr.kind === "string-literal") {
    // Address literals (0x + 40 hex chars) are not strings — they compile to address(...)
    if (ADDRESS_LITERAL_RE.test(expr.value)) return false;
    return true;
  }
  if (expr.kind === "identifier" && ctx.currentStringNames.has(expr.name))
    return true;
  if (
    expr.kind === "property-access" &&
    expr.object.kind === "identifier" &&
    expr.object.name === "this"
  ) {
    // For this.<prop>, always use the original state-var type map so that
    // local/param shadowing doesn't affect state-variable type resolution.
    const type = ctx.stateVarTypes.get(expr.property);
    return type?.kind === SkittlesTypeKind.String;
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

export const STRING_RETURNING_HELPERS = new Set([
  "_charAt",
  "_substring",
  "_toLowerCase",
  "_toUpperCase",
  "_trim",
  "_replace",
  "_replaceAll",
]);

// Internal helper to build a bytes(expr).length <op> 0 comparison
export function makeStringLengthComparison(
  inner: Expression,
  operator: string
): Expression {
  return {
    kind: "binary",
    operator,
    left: {
      kind: "property-access",
      object: {
        kind: "call",
        callee: { kind: "identifier", name: "bytes" },
        args: [inner],
      },
      property: "length",
    },
    right: { kind: "number-literal", value: "0" },
  };
}

export function wrapStringTruthiness(expr: Expression): Expression {
  // Recursively rewrite logical AND / OR so that any string operands
  // used in a boolean context are converted to length checks.
  if (
    expr.kind === "binary" &&
    (expr.operator === "&&" || expr.operator === "||")
  ) {
    return {
      ...expr,
      left: wrapStringTruthiness(expr.left),
      right: wrapStringTruthiness(expr.right),
    };
  }

  // Handle logical NOT. If it's directly applied to a string, translate
  // !str → bytes(str).length == 0. Otherwise, recurse into the operand.
  if (expr.kind === "unary" && expr.operator === "!" && expr.prefix) {
    if (isStringExpr(expr.operand)) {
      return makeStringLengthComparison(expr.operand, "==");
    }
    return {
      ...expr,
      operand: wrapStringTruthiness(expr.operand),
    };
  }

  // Handle conditional (ternary) expressions where condition or branches
  // are strings in boolean context: (flag ? a : b) where flag/a/b may
  // involve string truthiness.
  if (expr.kind === "conditional") {
    const wrappedCondition = wrapStringTruthiness(expr.condition);
    const wrappedTrue = wrapStringTruthiness(expr.whenTrue);
    const wrappedFalse = wrapStringTruthiness(expr.whenFalse);
    if (
      wrappedCondition !== expr.condition ||
      wrappedTrue !== expr.whenTrue ||
      wrappedFalse !== expr.whenFalse
    ) {
      return {
        ...expr,
        condition: wrappedCondition,
        whenTrue: wrappedTrue,
        whenFalse: wrappedFalse,
      };
    }
  }

  // Base case: a bare string expression in boolean context.
  if (isStringExpr(expr)) {
    return makeStringLengthComparison(expr, ">");
  }

  return expr;
}

export const STRING_METHODS: Record<
  string,
  { helper: string; minArgs: number; maxArgs: number }
> = {
  charAt: { helper: "_charAt", minArgs: 0, maxArgs: 1 },
  substring: { helper: "_substring", minArgs: 1, maxArgs: 2 },
  toLowerCase: { helper: "_toLowerCase", minArgs: 0, maxArgs: 0 },
  toUpperCase: { helper: "_toUpperCase", minArgs: 0, maxArgs: 0 },
  startsWith: { helper: "_startsWith", minArgs: 1, maxArgs: 1 },
  endsWith: { helper: "_endsWith", minArgs: 1, maxArgs: 1 },
  trim: { helper: "_trim", minArgs: 0, maxArgs: 0 },
  split: { helper: "_split", minArgs: 1, maxArgs: 1 },
  replace: { helper: "_replace", minArgs: 2, maxArgs: 2 },
  replaceAll: { helper: "_replaceAll", minArgs: 2, maxArgs: 2 },
};

export const KNOWN_ARRAY_METHODS = new Set([
  "includes",
  "indexOf",
  "lastIndexOf",
  "at",
  "slice",
  "concat",
  "filter",
  "map",
  "forEach",
  "some",
  "every",
  "find",
  "findIndex",
  "reduce",
  "remove",
  "reverse",
  "splice",
  "sort",
]);

export function describeExpectedArgs(
  method: string,
  argCount?: number
): string {
  const allArgs: Record<string, string[]> = {
    charAt: ["index"],
    substring: ["start", "end"],
    toLowerCase: [],
    toUpperCase: [],
    startsWith: ["prefix"],
    endsWith: ["suffix"],
    trim: [],
    split: ["delimiter"],
    replace: ["search", "replacement"],
    replaceAll: ["search", "replacement"],
  };
  const args = allArgs[method] ?? [];
  if (argCount !== undefined) return args.slice(0, argCount).join(", ");
  return args.join(", ");
}

export function validateReservedName(kind: string, name: string): void {
  if (name.startsWith("__sk_")) {
    throw new Error(
      `${kind} '${name}' uses the reserved prefix '__sk_'. Names starting with '__sk_' are reserved for compiler-generated identifiers.`
    );
  }
}

export function validateReservedVarName(name: string): void {
  validateReservedName("Variable name", name);
}

export function findEnclosingClass(
  node: ts.Node
): ts.ClassDeclaration | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isClassDeclaration(current)) return current;
    current = current.parent;
  }
  return undefined;
}

export function findMethodReturnType(
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

// IR construction helpers for generated array method code
export function mkId(name: string): Expression {
  return { kind: "identifier", name };
}
export function mkNum(value: string): Expression {
  return { kind: "number-literal", value };
}
export function mkProp(obj: Expression, prop: string): Expression {
  return { kind: "property-access", object: obj, property: prop };
}
export function mkElem(obj: Expression, index: Expression): Expression {
  return { kind: "element-access", object: obj, index };
}
export function mkBin(
  left: Expression,
  op: string,
  right: Expression
): Expression {
  return { kind: "binary", operator: op, left, right };
}
export function mkAssign(target: Expression, value: Expression): Expression {
  return { kind: "assignment", operator: "=", target, value };
}
export function mkIncr(name: string): Expression {
  return { kind: "unary", operator: "++", operand: mkId(name), prefix: false };
}
export function mkDecr(name: string): Expression {
  return { kind: "unary", operator: "--", operand: mkId(name), prefix: false };
}
export function mkVarDecl(
  name: string,
  type: SkittlesType | undefined,
  init?: Expression
): Statement {
  return { kind: "variable-declaration", name, type: type, initializer: init };
}
export function mkExprStmt(expr: Expression): Statement {
  return { kind: "expression", expression: expr };
}
export function mkReturn(value?: Expression): Statement {
  return { kind: "return", value };
}
export function mkIf(
  cond: Expression,
  thenBody: Statement[],
  elseBody?: Statement[]
): Statement {
  return { kind: "if", condition: cond, thenBody, elseBody };
}
export const UINT256_TYPE: SkittlesType = { kind: SkittlesTypeKind.Uint256 };
export const INT256_TYPE: SkittlesType = { kind: SkittlesTypeKind.Int256 };
export const BOOL_TYPE: SkittlesType = { kind: SkittlesTypeKind.Bool };

export const BUILTIN_IDENTIFIERS = new Set([
  "msg",
  "block",
  "tx",
  "self",
  "type",
  "abi",
  "this",
  "super",
]);

export function collectBareIdentifiers(expr: Expression): Set<string> {
  const ids = new Set<string>();
  function walkExpr(e: Expression) {
    switch (e.kind) {
      case "identifier":
        ids.add(e.name);
        break;
      case "binary":
        walkExpr(e.left);
        walkExpr(e.right);
        break;
      case "unary":
        walkExpr(e.operand);
        break;
      case "call":
        walkExpr(e.callee);
        e.args.forEach(walkExpr);
        break;
      case "property-access":
        walkExpr(e.object);
        break;
      case "element-access":
        walkExpr(e.object);
        walkExpr(e.index);
        break;
      case "assignment":
        walkExpr(e.target);
        walkExpr(e.value);
        break;
      case "conditional":
        walkExpr(e.condition);
        walkExpr(e.whenTrue);
        walkExpr(e.whenFalse);
        break;
      case "new":
        e.args.forEach(walkExpr);
        break;
      case "object-literal":
        e.properties.forEach((p) => walkExpr(p.value));
        break;
      case "tuple-literal":
        e.elements.forEach(walkExpr);
        break;
    }
  }
  walkExpr(expr);
  return ids;
}

export function collectBareIdentifiersFromStmts(
  stmts: Statement[]
): Set<string> {
  const ids = new Set<string>();
  function walkExpr(e: Expression) {
    for (const id of collectBareIdentifiers(e)) ids.add(id);
  }
  function walkStmts(ss: Statement[]) {
    for (const s of ss) walkStmt(s);
  }
  function walkStmt(s: Statement) {
    switch (s.kind) {
      case "expression":
        walkExpr(s.expression);
        break;
      case "return":
        if (s.value) walkExpr(s.value);
        break;
      case "variable-declaration":
        if (s.initializer) walkExpr(s.initializer);
        break;
      case "tuple-destructuring":
        walkExpr(s.initializer);
        break;
      case "if":
        walkExpr(s.condition);
        walkStmts(s.thenBody);
        if (s.elseBody) walkStmts(s.elseBody);
        break;
      case "for": {
        if (s.initializer) walkStmt(s.initializer);
        if (s.condition) walkExpr(s.condition);
        if (s.incrementor) walkExpr(s.incrementor);
        walkStmts(s.body);
        break;
      }
      case "while":
      case "do-while":
        walkExpr(s.condition);
        walkStmts(s.body);
        break;
      case "emit":
        s.args.forEach(walkExpr);
        break;
      case "revert":
        if (s.message) walkExpr(s.message);
        if (s.customErrorArgs) s.customErrorArgs.forEach(walkExpr);
        break;
      case "delete":
        walkExpr(s.target);
        break;
      case "switch":
        walkExpr(s.discriminant);
        s.cases.forEach((c) => {
          if (c.value) walkExpr(c.value);
          walkStmts(c.body);
        });
        break;
      case "try-catch":
        walkExpr(s.call);
        walkStmts(s.successBody);
        walkStmts(s.catchBody);
        break;
      case "console-log":
        s.args.forEach(walkExpr);
        break;
    }
  }
  walkStmts(stmts);
  return ids;
}

export function validateCallbackScope(
  expr: Expression | null,
  stmts: Statement[] | undefined,
  allowedNames: Set<string>,
  methodName: string
): void {
  const ids = expr
    ? collectBareIdentifiers(expr)
    : stmts
      ? collectBareIdentifiersFromStmts(stmts)
      : new Set<string>();
  for (const id of ids) {
    if (BUILTIN_IDENTIFIERS.has(id)) continue;
    if (allowedNames.has(id)) continue;
    throw new Error(
      `Array .${methodName}() callback references '${id}', which is not accessible in the generated helper. ` +
        `Callbacks can only reference their parameters, literals, and state variables (this.*).`
    );
  }
}

export function mkForLoop(
  indexName: string,
  arrayExpr: Expression,
  body: Statement[]
): Statement {
  return {
    kind: "for",
    initializer: {
      kind: "variable-declaration",
      name: indexName,
      type: UINT256_TYPE,
      initializer: mkNum("0"),
    },
    condition: mkBin(mkId(indexName), "<", mkProp(arrayExpr, "length")),
    incrementor: mkIncr(indexName),
    body,
  };
}

export function typeToSolidityName(type: SkittlesType): string {
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
    case SkittlesTypeKind.Struct:
      return type.structName ?? "UnknownStruct";
    case SkittlesTypeKind.Enum:
      return type.structName ?? "UnknownEnum";
    case SkittlesTypeKind.ContractInterface:
      return type.structName ?? "UnknownInterface";
    case SkittlesTypeKind.Array:
      return `${typeToSolidityName(type.valueType!)}[]`;
    default:
      return "uint256";
  }
}

export function getArrayHelperSuffix(
  elementType: SkittlesType | undefined
): string {
  if (!elementType) return "uint256";
  return identifierSafeType(elementType);
}

export function identifierSafeType(type: SkittlesType): string {
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
    case SkittlesTypeKind.Struct:
      return type.structName ?? "UnknownStruct";
    case SkittlesTypeKind.Enum:
      return type.structName ?? "UnknownEnum";
    case SkittlesTypeKind.ContractInterface:
      return type.structName ?? "UnknownInterface";
    case SkittlesTypeKind.Array:
      return `arr_${identifierSafeType(type.valueType!)}`;
    default:
      return "uint256";
  }
}

export function defaultValueForType(
  type: SkittlesType | undefined
): Expression | null {
  if (!type) return null;
  switch (type.kind) {
    case SkittlesTypeKind.Uint256:
    case SkittlesTypeKind.Int256:
      return { kind: "number-literal", value: "0" };
    case SkittlesTypeKind.Bool:
      return { kind: "boolean-literal", value: false };
    case SkittlesTypeKind.Address:
      return { kind: "identifier", name: "address(0)" };
    default:
      return null;
  }
}

export function getVisibility(
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

export function hasModifier(
  modifiers: readonly ts.ModifierLike[] | undefined,
  kind: ts.SyntaxKind
): boolean {
  if (!modifiers) return false;
  return modifiers.some((mod) => mod.kind === kind);
}

export function getBinaryOperator(kind: ts.SyntaxKind): string {
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

export function isAssignmentOperator(kind: ts.SyntaxKind): boolean {
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

export function getUnaryOperator(kind: ts.SyntaxKind): string {
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
