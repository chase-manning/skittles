import type { Expression, Statement } from "../../types/index.ts";

// ============================================================
// Shadowed local variable renaming
// ============================================================

export function collectLocalVarNames(stmts: Statement[]): Set<string> {
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
        if (s.elseBody)
          for (const n of collectLocalVarNames(s.elseBody)) names.add(n);
        break;
      case "for":
        if (s.initializer?.kind === "variable-declaration")
          names.add(s.initializer.name);
        for (const n of collectLocalVarNames(s.body)) names.add(n);
        break;
      case "while":
      case "do-while":
        for (const n of collectLocalVarNames(s.body)) names.add(n);
        break;
      case "switch":
        for (const c of s.cases)
          for (const n of collectLocalVarNames(c.body)) names.add(n);
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

export function pickNewName(original: string, taken: Set<string>): string {
  let candidate = `_${original}`;
  while (taken.has(candidate)) {
    candidate = `_${candidate}`;
  }
  return candidate;
}

export function renameInExpression(
  expr: Expression,
  renames: Map<string, string>
): Expression {
  switch (expr.kind) {
    case "identifier": {
      const newName = renames.get(expr.name);
      return newName ? { ...expr, name: newName } : expr;
    }
    case "binary":
      return {
        ...expr,
        left: renameInExpression(expr.left, renames),
        right: renameInExpression(expr.right, renames),
      };
    case "unary":
      return { ...expr, operand: renameInExpression(expr.operand, renames) };
    case "assignment":
      return {
        ...expr,
        target: renameInExpression(expr.target, renames),
        value: renameInExpression(expr.value, renames),
      };
    case "call":
      return {
        ...expr,
        callee: renameInExpression(expr.callee, renames),
        args: expr.args.map((a) => renameInExpression(a, renames)),
      };
    case "conditional":
      return {
        ...expr,
        condition: renameInExpression(expr.condition, renames),
        whenTrue: renameInExpression(expr.whenTrue, renames),
        whenFalse: renameInExpression(expr.whenFalse, renames),
      };
    case "property-access":
      return { ...expr, object: renameInExpression(expr.object, renames) };
    case "element-access":
      return {
        ...expr,
        object: renameInExpression(expr.object, renames),
        index: renameInExpression(expr.index, renames),
      };
    case "new":
      return {
        ...expr,
        args: expr.args.map((a) => renameInExpression(a, renames)),
      };
    case "object-literal":
      return {
        ...expr,
        properties: expr.properties.map((p) => ({
          ...p,
          value: renameInExpression(p.value, renames),
        })),
      };
    case "tuple-literal":
      return {
        ...expr,
        elements: expr.elements.map((e) => renameInExpression(e, renames)),
      };
    default:
      return expr;
  }
}

function renameInStatement(
  stmt: Statement,
  renames: Map<string, string>
): Statement {
  switch (stmt.kind) {
    case "variable-declaration": {
      const newName = renames.get(stmt.name) ?? stmt.name;
      return {
        ...stmt,
        name: newName,
        initializer: stmt.initializer
          ? renameInExpression(stmt.initializer, renames)
          : undefined,
      };
    }
    case "tuple-destructuring": {
      const newNames = stmt.names.map((n) =>
        n === null ? null : (renames.get(n) ?? n)
      );
      return {
        ...stmt,
        names: newNames,
        initializer: renameInExpression(stmt.initializer, renames),
      };
    }
    case "return":
      return {
        ...stmt,
        value: stmt.value ? renameInExpression(stmt.value, renames) : undefined,
      };
    case "expression":
      return {
        ...stmt,
        expression: renameInExpression(stmt.expression, renames),
      };
    case "if":
      return {
        ...stmt,
        condition: renameInExpression(stmt.condition, renames),
        thenBody: renameInStatements(stmt.thenBody, renames),
        elseBody: stmt.elseBody
          ? renameInStatements(stmt.elseBody, renames)
          : undefined,
      };
    case "for": {
      let init = stmt.initializer;
      if (init) {
        init = renameInStatement(init, renames) as typeof init;
      }
      return {
        ...stmt,
        initializer: init,
        condition: stmt.condition
          ? renameInExpression(stmt.condition, renames)
          : undefined,
        incrementor: stmt.incrementor
          ? renameInExpression(stmt.incrementor, renames)
          : undefined,
        body: renameInStatements(stmt.body, renames),
      };
    }
    case "while":
    case "do-while":
      return {
        ...stmt,
        condition: renameInExpression(stmt.condition, renames),
        body: renameInStatements(stmt.body, renames),
      };
    case "emit":
      return {
        ...stmt,
        args: stmt.args.map((a) => renameInExpression(a, renames)),
      };
    case "revert":
      return {
        ...stmt,
        message: stmt.message
          ? renameInExpression(stmt.message, renames)
          : undefined,
        customErrorArgs: stmt.customErrorArgs?.map((a) =>
          renameInExpression(a, renames)
        ),
      };
    case "delete":
      return { ...stmt, target: renameInExpression(stmt.target, renames) };
    case "switch":
      return {
        ...stmt,
        discriminant: renameInExpression(stmt.discriminant, renames),
        cases: stmt.cases.map((c) => ({
          ...c,
          value: c.value ? renameInExpression(c.value, renames) : undefined,
          body: renameInStatements(c.body, renames),
        })),
      };
    case "try-catch": {
      const newReturnVarName = stmt.returnVarName
        ? (renames.get(stmt.returnVarName) ?? stmt.returnVarName)
        : undefined;
      return {
        ...stmt,
        call: renameInExpression(stmt.call, renames),
        returnVarName: newReturnVarName,
        successBody: renameInStatements(stmt.successBody, renames),
        catchBody: renameInStatements(stmt.catchBody, renames),
      };
    }
    case "console-log":
      return {
        ...stmt,
        args: stmt.args.map((a) => renameInExpression(a, renames)),
      };
    default:
      return stmt;
  }
}

export function renameInStatements(
  stmts: Statement[],
  renames: Map<string, string>
): Statement[] {
  return stmts.map((s) => renameInStatement(s, renames));
}

// Scope-aware renaming: renames are activated only when their declaration is
// encountered, and inner-block declarations do not leak to outer scopes.

export function scopeAwareRenameBlock(
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
      } else if (
        stmt.returnVarName &&
        tryActive.has(stmt.returnVarName) &&
        !allRenames.has(stmt.returnVarName)
      ) {
        // Suppress pre-activated rename when try-catch return var re-declares the same name
        tryActive.delete(stmt.returnVarName);
      }
      return {
        stmt: {
          ...stmt,
          call: renameInExpression(stmt.call, active),
          returnVarName: newReturnVarName,
          successBody: scopeAwareRenameBlock(
            stmt.successBody,
            tryActive,
            allRenames
          ),
          catchBody: scopeAwareRenameBlock(stmt.catchBody, active, allRenames),
        },
        active,
      };
    }
    default:
      return { stmt: renameInStatement(stmt, active), active };
  }
}

export function resolveShadowedLocals(
  body: Statement[],
  stateVarNames: Set<string>,
  paramNames?: Set<string>
): Statement[] {
  const localNames = collectLocalVarNames(body);
  const shadowed = new Set<string>();
  for (const name of localNames) {
    if (stateVarNames.has(name)) {
      shadowed.add(name);
    }
  }
  if (shadowed.size === 0) return body;

  const taken = new Set([
    ...stateVarNames,
    ...localNames,
    ...(paramNames ?? []),
  ]);
  const renames = new Map<string, string>();
  for (const name of shadowed) {
    const newName = pickNewName(name, taken);
    renames.set(name, newName);
    taken.add(newName);
  }
  return scopeAwareRenameBlock(body, new Map(), renames);
}
