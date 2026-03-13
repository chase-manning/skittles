import type { Statement, Expression } from "../types/index.ts";

/**
 * Visitor interface for walking AST nodes. Both callbacks are optional;
 * only the ones you provide will be invoked.
 */
export interface ASTVisitor {
  visitExpression?(expr: Expression): void;
  visitStatement?(stmt: Statement): void;
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
        stmt.thenBody.forEach(walkStmt);
        stmt.elseBody?.forEach(walkStmt);
        break;
      case "for":
        if (stmt.initializer) walkStmt(stmt.initializer);
        if (stmt.condition) walkExpression(stmt.condition, visitor);
        if (stmt.incrementor) walkExpression(stmt.incrementor, visitor);
        stmt.body.forEach(walkStmt);
        break;
      case "while":
        walkExpression(stmt.condition, visitor);
        stmt.body.forEach(walkStmt);
        break;
      case "revert":
        if (stmt.message) walkExpression(stmt.message, visitor);
        if (stmt.customErrorArgs)
          stmt.customErrorArgs.forEach((a) => walkExpression(a, visitor));
        break;
      case "do-while":
        walkExpression(stmt.condition, visitor);
        stmt.body.forEach(walkStmt);
        break;
      case "emit":
        stmt.args.forEach((a) => walkExpression(a, visitor));
        break;
      case "switch":
        walkExpression(stmt.discriminant, visitor);
        for (const c of stmt.cases) {
          if (c.value) walkExpression(c.value, visitor);
          c.body.forEach(walkStmt);
        }
        break;
      case "delete":
        walkExpression(stmt.target, visitor);
        break;
      case "try-catch":
        walkExpression(stmt.call, visitor);
        stmt.successBody.forEach(walkStmt);
        stmt.catchBody.forEach(walkStmt);
        break;
      case "console-log":
        stmt.args.forEach((a) => walkExpression(a, visitor));
        break;
    }
  }

  stmts.forEach(walkStmt);
}

/**
 * Recursively filter a statement list, removing any statements for which the
 * predicate returns `true`. The predicate is tested against statements nested
 * inside control-flow structures (if/for/while/do-while/switch/try-catch) so
 * that matching nodes deep in the tree are also removed.
 */
export function filterStatements(
  stmts: Statement[],
  shouldRemove: (stmt: Statement) => boolean
): Statement[] {
  return stmts.reduce<Statement[]>((acc, stmt) => {
    if (shouldRemove(stmt)) return acc;
    if (stmt.kind === "if") {
      acc.push({
        ...stmt,
        thenBody: filterStatements(stmt.thenBody, shouldRemove),
        elseBody: stmt.elseBody
          ? filterStatements(stmt.elseBody, shouldRemove)
          : undefined,
      });
    } else if (
      stmt.kind === "for" ||
      stmt.kind === "while" ||
      stmt.kind === "do-while"
    ) {
      acc.push({
        ...stmt,
        body: filterStatements(stmt.body, shouldRemove),
      });
    } else if (stmt.kind === "switch") {
      acc.push({
        ...stmt,
        cases: stmt.cases.map((c) => ({
          ...c,
          body: filterStatements(c.body, shouldRemove),
        })),
      });
    } else if (stmt.kind === "try-catch") {
      acc.push({
        ...stmt,
        successBody: filterStatements(stmt.successBody, shouldRemove),
        catchBody: filterStatements(stmt.catchBody, shouldRemove),
      });
    } else {
      acc.push(stmt);
    }
    return acc;
  }, []);
}
