import type {
  Statement,
  Expression,
  SkittlesFunction,
  SkittlesConstructor,
} from "../types/index.ts";
import { walkStatements } from "./walker.ts";

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
  warnings.push(
    ...checkUnusedVariables(
      fn.body,
      fn.parameters.map((p) => p.name),
      contractName,
      name
    )
  );

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
 * and used identifier names via the shared AST walker.
 */
function walkAllStatements(
  stmts: Statement[],
  declared: Set<string>,
  used: Set<string>
): void {
  walkStatements(stmts, {
    visitStatement(stmt) {
      if (stmt.kind === "variable-declaration") {
        declared.add(stmt.name);
      }
      if (stmt.kind === "tuple-destructuring") {
        for (const n of stmt.names) if (n !== null) declared.add(n);
      }
      if (stmt.kind === "try-catch" && stmt.returnVarName) {
        declared.add(stmt.returnVarName);
      }
    },
    visitExpression(expr) {
      if (expr.kind === "identifier") {
        used.add(expr.name);
      }
    },
  });
}
