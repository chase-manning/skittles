import type { Statement, Expression, SkittlesFunction, SkittlesConstructor } from "../types/index.ts";

/**
 * Analyze a function body for unreachable code and unused local variables.
 * Returns an array of warning strings.
 */
export function analyzeFunction(
  fn: SkittlesFunction | SkittlesConstructor,
  contractName: string
): string[] {
  const warnings: string[] = [];
  const name = "name" in fn ? fn.name : "constructor";

  warnings.push(...checkUnreachableCode(fn.body, contractName, name));
  warnings.push(...checkUnusedVariables(fn.body, fn.parameters.map((p) => p.name), contractName, name));

  return warnings;
}

/**
 * Check for unreachable code after return, throw (revert), break, or continue statements.
 */
function checkUnreachableCode(
  statements: Statement[],
  contractName: string,
  functionName: string
): string[] {
  const warnings: string[] = [];

  function checkBlock(stmts: Statement[]): void {
    for (let i = 0; i < stmts.length; i++) {
      const stmt = stmts[i];

      if (isTerminating(stmt) && i < stmts.length - 1) {
        warnings.push(
          `${contractName}.${functionName}: Unreachable code after '${stmt.kind === "revert" ? "throw" : stmt.kind}' statement`
        );
        break;
      }

      // Recurse into nested blocks
      walkNestedBlocks(stmt, checkBlock);
    }
  }

  checkBlock(statements);
  return warnings;
}

/**
 * Returns true if a statement always terminates execution flow (return, revert, break, continue).
 */
function isTerminating(stmt: Statement): boolean {
  return (
    stmt.kind === "return" ||
    stmt.kind === "revert" ||
    stmt.kind === "break" ||
    stmt.kind === "continue"
  );
}

/**
 * Recurse into nested blocks of a statement.
 */
function walkNestedBlocks(
  stmt: Statement,
  visitor: (stmts: Statement[]) => void
): void {
  switch (stmt.kind) {
    case "if":
      visitor(stmt.thenBody);
      if (stmt.elseBody) visitor(stmt.elseBody);
      break;
    case "for":
      visitor(stmt.body);
      break;
    case "while":
      visitor(stmt.body);
      break;
    case "do-while":
      visitor(stmt.body);
      break;
    case "switch":
      for (const c of stmt.cases) {
        visitor(c.body);
      }
      break;
    case "try-catch":
      visitor(stmt.successBody);
      visitor(stmt.catchBody);
      break;
  }
}

/**
 * Check for unused local variables in a function body.
 * A variable is considered unused if it is declared but never referenced
 * in any expression (including in nested blocks).
 */
function checkUnusedVariables(
  statements: Statement[],
  parameterNames: string[],
  contractName: string,
  functionName: string
): string[] {
  const warnings: string[] = [];
  const declared = new Set<string>();
  const used = new Set<string>();

  // Collect all variable declarations and identifier usages
  walkAllStatements(statements, declared, used);

  // Only warn about declared locals that are never used in any expression
  // Skip parameters – they may be required by an interface signature
  for (const name of declared) {
    if (!used.has(name) && !parameterNames.includes(name)) {
      warnings.push(
        `${contractName}.${functionName}: Unused variable '${name}'`
      );
    }
  }

  return warnings;
}

/**
 * Walk all statements recursively, collecting declared variable names
 * and used identifier names.
 */
function walkAllStatements(
  stmts: Statement[],
  declared: Set<string>,
  used: Set<string>
): void {
  for (const stmt of stmts) {
    switch (stmt.kind) {
      case "variable-declaration":
        declared.add(stmt.name);
        if (stmt.initializer) collectUsedIdentifiers(stmt.initializer, used);
        break;
      case "return":
        if (stmt.value) collectUsedIdentifiers(stmt.value, used);
        break;
      case "expression":
        collectUsedIdentifiers(stmt.expression, used);
        break;
      case "if":
        collectUsedIdentifiers(stmt.condition, used);
        walkAllStatements(stmt.thenBody, declared, used);
        if (stmt.elseBody) walkAllStatements(stmt.elseBody, declared, used);
        break;
      case "for":
        if (stmt.initializer) {
          if (stmt.initializer.kind === "variable-declaration") {
            declared.add(stmt.initializer.name);
            if (stmt.initializer.initializer)
              collectUsedIdentifiers(stmt.initializer.initializer, used);
          } else {
            collectUsedIdentifiers(stmt.initializer.expression, used);
          }
        }
        if (stmt.condition) collectUsedIdentifiers(stmt.condition, used);
        if (stmt.incrementor) collectUsedIdentifiers(stmt.incrementor, used);
        walkAllStatements(stmt.body, declared, used);
        break;
      case "while":
        collectUsedIdentifiers(stmt.condition, used);
        walkAllStatements(stmt.body, declared, used);
        break;
      case "do-while":
        collectUsedIdentifiers(stmt.condition, used);
        walkAllStatements(stmt.body, declared, used);
        break;
      case "revert":
        if (stmt.message) collectUsedIdentifiers(stmt.message, used);
        if (stmt.customErrorArgs) {
          for (const arg of stmt.customErrorArgs) {
            collectUsedIdentifiers(arg, used);
          }
        }
        break;
      case "emit":
        for (const arg of stmt.args) {
          collectUsedIdentifiers(arg, used);
        }
        break;
      case "switch":
        collectUsedIdentifiers(stmt.discriminant, used);
        for (const c of stmt.cases) {
          if (c.value) collectUsedIdentifiers(c.value, used);
          walkAllStatements(c.body, declared, used);
        }
        break;
      case "delete":
        collectUsedIdentifiers(stmt.target, used);
        break;
      case "try-catch":
        collectUsedIdentifiers(stmt.call, used);
        if (stmt.returnVarName) declared.add(stmt.returnVarName);
        walkAllStatements(stmt.successBody, declared, used);
        walkAllStatements(stmt.catchBody, declared, used);
        break;
    }
  }
}

/**
 * Collect all identifier names used in an expression.
 */
function collectUsedIdentifiers(expr: Expression, used: Set<string>): void {
  switch (expr.kind) {
    case "identifier":
      used.add(expr.name);
      break;
    case "binary":
      collectUsedIdentifiers(expr.left, used);
      collectUsedIdentifiers(expr.right, used);
      break;
    case "unary":
      collectUsedIdentifiers(expr.operand, used);
      break;
    case "assignment":
      collectUsedIdentifiers(expr.target, used);
      collectUsedIdentifiers(expr.value, used);
      break;
    case "call":
      collectUsedIdentifiers(expr.callee, used);
      for (const arg of expr.args) {
        collectUsedIdentifiers(arg, used);
      }
      break;
    case "property-access":
      collectUsedIdentifiers(expr.object, used);
      break;
    case "element-access":
      collectUsedIdentifiers(expr.object, used);
      collectUsedIdentifiers(expr.index, used);
      break;
    case "conditional":
      collectUsedIdentifiers(expr.condition, used);
      collectUsedIdentifiers(expr.whenTrue, used);
      collectUsedIdentifiers(expr.whenFalse, used);
      break;
    case "new":
      for (const arg of expr.args) {
        collectUsedIdentifiers(arg, used);
      }
      break;
    case "object-literal":
      for (const prop of expr.properties) {
        collectUsedIdentifiers(prop.value, used);
      }
      break;
    case "tuple-literal":
      for (const elem of expr.elements) {
        collectUsedIdentifiers(elem, used);
      }
      break;
  }
}
