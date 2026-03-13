import type { Expression, Statement } from "../types/index.ts";

/**
 * Visitor interface for walking AST nodes. Both callbacks are optional;
 * only the ones you provide will be invoked.
 */
export interface ASTVisitor {
  visitExpression?(expr: Expression): void;
  visitStatement?(stmt: Statement): void;
}

/**
 * Invoke `callback` once for every nested body array inside `stmt`.
 * This centralises knowledge of which statement kinds contain nested
 * statement bodies so that walkers, filters and predicates do not
 * duplicate the same switch.
 */
function forEachStatementBody(
  stmt: Statement,
  callback: (body: Statement[]) => void
): void {
  switch (stmt.kind) {
    case "if":
      callback(stmt.thenBody);
      if (stmt.elseBody) callback(stmt.elseBody);
      break;
    case "for":
    case "while":
    case "do-while":
      callback(stmt.body);
      break;
    case "switch":
      for (const c of stmt.cases) callback(c.body);
      break;
    case "try-catch":
      callback(stmt.successBody);
      callback(stmt.catchBody);
      break;
  }
}

/**
 * Return a shallow copy of `stmt` with every nested body array replaced
 * by the result of calling `mapBody` on the original.  Statements
 * without nested bodies are returned as-is.
 */
function mapStatementBodies(
  stmt: Statement,
  mapBody: (body: Statement[]) => Statement[]
): Statement {
  switch (stmt.kind) {
    case "if":
      return {
        ...stmt,
        thenBody: mapBody(stmt.thenBody),
        elseBody: stmt.elseBody ? mapBody(stmt.elseBody) : undefined,
      };
    case "for":
    case "while":
    case "do-while":
      return { ...stmt, body: mapBody(stmt.body) };
    case "switch":
      return {
        ...stmt,
        cases: stmt.cases.map((c) => ({ ...c, body: mapBody(c.body) })),
      };
    case "try-catch":
      return {
        ...stmt,
        successBody: mapBody(stmt.successBody),
        catchBody: mapBody(stmt.catchBody),
      };
    default:
      return stmt;
  }
}

/**
 * Walk an expression tree, invoking the visitor's `visitExpression` callback
 * (if provided) on every expression node in pre-order.
 */
export function walkExpression(expr: Expression, visitor: ASTVisitor): void {
  if (visitor.visitExpression) visitor.visitExpression(expr);
  switch (expr.kind) {
    case "binary":
      walkExpression(expr.left, visitor);
      walkExpression(expr.right, visitor);
      break;
    case "unary":
      walkExpression(expr.operand, visitor);
      break;
    case "assignment":
      walkExpression(expr.target, visitor);
      walkExpression(expr.value, visitor);
      break;
    case "call":
      walkExpression(expr.callee, visitor);
      expr.args.forEach((a) => walkExpression(a, visitor));
      break;
    case "property-access":
      walkExpression(expr.object, visitor);
      break;
    case "element-access":
      walkExpression(expr.object, visitor);
      walkExpression(expr.index, visitor);
      break;
    case "conditional":
      walkExpression(expr.condition, visitor);
      walkExpression(expr.whenTrue, visitor);
      walkExpression(expr.whenFalse, visitor);
      break;
    case "new":
      expr.args.forEach((a) => walkExpression(a, visitor));
      break;
    case "object-literal":
      expr.properties.forEach((p) => walkExpression(p.value, visitor));
      break;
    case "tuple-literal":
      expr.elements.forEach((e) => walkExpression(e, visitor));
      break;
  }
}

/**
 * Walk a list of statements, invoking the visitor's `visitStatement` and
 * `visitExpression` callbacks on every node in pre-order.
 */
export function walkStatements(
  stmts: Statement[],
  visitor: ASTVisitor
): void {
  function walkStmt(stmt: Statement): void {
    if (visitor.visitStatement) visitor.visitStatement(stmt);
    // Walk expressions owned directly by the statement.
    switch (stmt.kind) {
      case "return":
        if (stmt.value) walkExpression(stmt.value, visitor);
        break;
      case "variable-declaration":
        if (stmt.initializer) walkExpression(stmt.initializer, visitor);
        break;
      case "tuple-destructuring":
        walkExpression(stmt.initializer, visitor);
        break;
      case "expression":
        walkExpression(stmt.expression, visitor);
        break;
      case "if":
        walkExpression(stmt.condition, visitor);
        break;
      case "for":
        if (stmt.initializer) walkStmt(stmt.initializer);
        if (stmt.condition) walkExpression(stmt.condition, visitor);
        if (stmt.incrementor) walkExpression(stmt.incrementor, visitor);
        break;
      case "while":
      case "do-while":
        walkExpression(stmt.condition, visitor);
        break;
      case "revert":
        if (stmt.message) walkExpression(stmt.message, visitor);
        if (stmt.customErrorArgs)
          stmt.customErrorArgs.forEach((a) => walkExpression(a, visitor));
        break;
      case "emit":
        stmt.args.forEach((a) => walkExpression(a, visitor));
        break;
      case "switch":
        walkExpression(stmt.discriminant, visitor);
        for (const c of stmt.cases) {
          if (c.value) walkExpression(c.value, visitor);
        }
        break;
      case "delete":
        walkExpression(stmt.target, visitor);
        break;
      case "try-catch":
        walkExpression(stmt.call, visitor);
        break;
      case "console-log":
        stmt.args.forEach((a) => walkExpression(a, visitor));
        break;
    }
    // Recurse into nested statement bodies using the shared helper.
    forEachStatementBody(stmt, (body) => body.forEach(walkStmt));
  }

  stmts.forEach(walkStmt);
}

/**
 * Recursively filter a statement list, removing any statements for which the
 * predicate returns `true`. The predicate is tested against statements nested
 * inside control-flow structures (if/for/while/do-while/switch/try-catch) so
 * that matching nodes deep in the tree are also removed.
 *
 * Uses the shared `mapStatementBodies` helper to avoid duplicating the
 * switch over statement kinds that contain nested bodies.
 */
export function filterStatements(
  stmts: Statement[],
  shouldRemove: (stmt: Statement) => boolean
): Statement[] {
  const recurse = (body: Statement[]) => filterStatements(body, shouldRemove);
  return stmts.reduce<Statement[]>((acc, stmt) => {
    if (shouldRemove(stmt)) return acc;
    acc.push(mapStatementBodies(stmt, recurse));
    return acc;
  }, []);
}

/**
 * Return `true` if any statement (including those nested inside
 * control-flow bodies) satisfies `predicate`.  Short-circuits as soon
 * as a match is found.
 */
export function containsStatement(
  stmts: Statement[],
  predicate: (stmt: Statement) => boolean
): boolean {
  for (const stmt of stmts) {
    if (predicate(stmt)) return true;
    let found = false;
    forEachStatementBody(stmt, (body) => {
      if (!found && containsStatement(body, predicate)) found = true;
    });
    if (found) return true;
  }
  return false;
}
