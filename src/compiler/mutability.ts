import ts from "typescript";
import {
  SkittlesTypeKind,
  type SkittlesParameter,
  type SkittlesType,
  type SkittlesFunction,
  type SkittlesContractInterface,
  type SkittlesContract,
  type StateMutability,
  type Statement,
  type Expression,
} from "../types/index.ts";
import { ctx } from "./parser-context.ts";
import { inferType } from "./type-parser.ts";

/**
 * Propagate state mutability across call chains.
 * If function A calls this.B() and B is nonpayable, A becomes nonpayable.
 * If function A calls this.B() and B is view, A becomes at least view.
 * Uses fixpoint iteration until stable.
 */
export function propagateStateMutability(functions: SkittlesFunction[]): void {
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
export function walkStatements(
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
      case "tuple-literal":
        expr.elements.forEach(walkExpr);
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
      case "tuple-destructuring":
        walkExpr(stmt.initializer);
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
        if (stmt.customErrorArgs) stmt.customErrorArgs.forEach(walkExpr);
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

export function collectThisCalls(stmts: Statement[]): string[] {
  const names: string[] = [];
  walkStatements(stmts, (expr) => {
    if (
      expr.kind === "call" &&
      expr.callee.kind === "property-access" &&
      expr.callee.object.kind === "identifier" &&
      (expr.callee.object.name === "this" || expr.callee.object.name === "super")
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
export function collectExternalInterfaceCalls(
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
      if (propType?.kind === (SkittlesTypeKind.ContractInterface) && propType.structName) {
        calls.push({ ifaceName: propType.structName, methodName });
      }
    }

    // token.method() — local/param variable access
    if (
      expr.callee.object.kind === "identifier" &&
      expr.callee.object.name !== "this"
    ) {
      const varType = localVarTypes.get(expr.callee.object.name);
      if (varType?.kind === (SkittlesTypeKind.ContractInterface) && varType.structName) {
        calls.push({ ifaceName: varType.structName, methodName });
      }
    }
  }, (stmt) => {
    // Track local variable declarations of contract-interface types
    if (stmt.kind === "variable-declaration" && stmt.type &&
        stmt.type.kind === (SkittlesTypeKind.ContractInterface) && stmt.name) {
      localVarTypes.set(stmt.name, stmt.type);
    }
  });
  return calls;
}

export function inferAbstractStateMutability(): StateMutability {
  return "nonpayable";
}

/**
 * Walk a function body and convert property accesses on contract-interface
 * typed variables into zero-argument call expressions.
 *
 * Example:  `this.token.name`  →  `this.token.name()`
 *
 * This ensures codegen emits the required `()` in Solidity (interface
 * property getters are functions) and that mutability inference recognises
 * these as external contract calls.
 */
export function rewriteInterfacePropertyGetters(
  body: Statement[],
  varTypes: Map<string, SkittlesType>,
  params?: SkittlesParameter[]
): Statement[] {
  const localVarTypes = new Map<string, SkittlesType>();
  if (params) {
    for (const p of params) {
      localVarTypes.set(p.name, p.type);
    }
  }

  function isInterfacePropAccess(expr: Expression): boolean {
    if (expr.kind !== "property-access") return false;

    // Pattern A: this.<stateVar>.<property>
    if (
      expr.object.kind === "property-access" &&
      expr.object.object.kind === "identifier" &&
      expr.object.object.name === "this"
    ) {
      const propType = ctx.stateVarTypes.get(expr.object.property);
      if (propType && propType.kind === (SkittlesTypeKind.ContractInterface) && propType.structName) {
        const iface = ctx.knownContractInterfaceMap.get(propType.structName);
        if (iface && iface.functions.some(f => f.name === expr.property)) return true;
      }
    }

    // Pattern B: <localVar>.<property>
    if (
      expr.object.kind === "identifier" &&
      expr.object.name !== "this"
    ) {
      const varType = localVarTypes.get(expr.object.name) ?? varTypes.get(expr.object.name);
      if (varType && varType.kind === (SkittlesTypeKind.ContractInterface) && varType.structName) {
        const iface = ctx.knownContractInterfaceMap.get(varType.structName);
        if (iface && iface.functions.some(f => f.name === expr.property)) return true;
      }
    }

    return false;
  }

  function transformExpr(expr: Expression, isCallCallee: boolean): Expression {
    switch (expr.kind) {
      case "call": {
        let callee = expr.callee;
        if (callee.kind === "property-access") {
          // Don't transform the callee itself (it's already in call position),
          // but do transform its sub-expressions.
          callee = { ...callee, object: transformExpr(callee.object, false) };
        } else {
          callee = transformExpr(callee, true);
        }
        return { ...expr, callee, args: expr.args.map(a => transformExpr(a, false)) };
      }
      case "property-access": {
        const newExpr: Expression = { ...expr, object: transformExpr(expr.object, false) };
        if (!isCallCallee && isInterfacePropAccess(newExpr)) {
          return { kind: "call", callee: newExpr, args: [] } as Expression;
        }
        return newExpr;
      }
      case "binary":
        return { ...expr, left: transformExpr(expr.left, false), right: transformExpr(expr.right, false) };
      case "unary":
        return { ...expr, operand: transformExpr(expr.operand, false) };
      case "assignment":
        return { ...expr, target: transformExpr(expr.target, false), value: transformExpr(expr.value, false) };
      case "conditional":
        return { ...expr, condition: transformExpr(expr.condition, false), whenTrue: transformExpr(expr.whenTrue, false), whenFalse: transformExpr(expr.whenFalse, false) };
      case "element-access":
        return { ...expr, object: transformExpr(expr.object, false), index: transformExpr(expr.index, false) };
      case "new":
        return { ...expr, args: expr.args.map(a => transformExpr(a, false)) };
      case "object-literal":
        return { ...expr, properties: expr.properties.map(p => ({ ...p, value: transformExpr(p.value, false) })) };
      case "tuple-literal":
        return { ...expr, elements: expr.elements.map(e => transformExpr(e, false)) };
      default:
        return expr;
    }
  }

  function transformStmt(stmt: Statement): Statement {
    switch (stmt.kind) {
      case "return":
        return { ...stmt, value: stmt.value ? transformExpr(stmt.value, false) : undefined };
      case "variable-declaration": {
        const transformed = { ...stmt, initializer: stmt.initializer ? transformExpr(stmt.initializer, false) : undefined };
        if (stmt.type && stmt.type.kind === (SkittlesTypeKind.ContractInterface) && stmt.name) {
          localVarTypes.set(stmt.name, stmt.type);
        }
        return transformed;
      }
      case "expression":
        return { ...stmt, expression: transformExpr(stmt.expression, false) };
      case "if":
        return { ...stmt, condition: transformExpr(stmt.condition, false), thenBody: stmt.thenBody.map(transformStmt), elseBody: stmt.elseBody?.map(transformStmt) };
      case "for": {
        let initializer = stmt.initializer;
        if (initializer) {
          switch (initializer.kind) {
            case "variable-declaration":
            case "expression":
              initializer = transformStmt(initializer) as typeof initializer;
              break;
          }
        }
        return {
          ...stmt,
          initializer,
          condition: stmt.condition ? transformExpr(stmt.condition, false) : undefined,
          incrementor: stmt.incrementor ? transformExpr(stmt.incrementor, false) : undefined,
          body: stmt.body.map(transformStmt),
        };
      }
      case "while":
      case "do-while":
        return { ...stmt, condition: transformExpr(stmt.condition, false), body: stmt.body.map(transformStmt) };
      case "revert":
        return { ...stmt, message: stmt.message ? transformExpr(stmt.message, false) : undefined, customErrorArgs: stmt.customErrorArgs?.map(a => transformExpr(a, false)) };
      case "emit":
        return { ...stmt, args: stmt.args.map(a => transformExpr(a, false)) };
      case "delete":
        return { ...stmt, target: transformExpr(stmt.target, false) };
      case "try-catch":
        return { ...stmt, call: transformExpr(stmt.call, false), successBody: stmt.successBody.map(transformStmt), catchBody: stmt.catchBody.map(transformStmt) };
      case "switch":
        return { ...stmt, discriminant: transformExpr(stmt.discriminant, false), cases: stmt.cases.map(c => ({ ...c, body: c.body.map(transformStmt), value: c.value ? transformExpr(c.value, false) : undefined })) };
      case "console-log":
        return { ...stmt, args: stmt.args.map(a => transformExpr(a, false)) };
      default:
        return stmt;
    }
  }

  return body.map(transformStmt);
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

  // Build a combined type map once for inferType lookups (e.g. .balance).
  // Outer-scope types first, then local types which take precedence on name collisions.
  const combinedVarTypes = new Map<string, SkittlesType>();
  varTypes?.forEach((value, key) => {
    combinedVarTypes.set(key, value);
  });
  localVarTypes.forEach((value, key) => {
    combinedVarTypes.set(key, value);
  });

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
      // addr.balance reads the ETH balance of an address (blockchain state read)
      // Exclude this.balance which refers to a state variable named "balance"
      if (
        expr.kind === "property-access" &&
        expr.property === "balance" &&
        !(expr.object.kind === "identifier" && expr.object.name === "this")
      ) {
        // Treat both typed addresses and explicit address(...) casts as address-like
        const objType = inferType(expr.object, combinedVarTypes);
        const isAddressLike =
          objType?.kind === (SkittlesTypeKind.Address) ||
          (
            expr.object.kind === "call" &&
            expr.object.callee.kind === "identifier" &&
            expr.object.callee.name === "address"
          );
        if (isAddressLike) {
          readsState = true;
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
      if (stmt.kind === "variable-declaration" && stmt.type && stmt.name) {
        // Only track contract-interface typed locals in localVarTypes
        // (used for external call detection / .transfer() classification).
        if (stmt.type.kind === (SkittlesTypeKind.ContractInterface)) {
          localVarTypes.set(stmt.name, stmt.type);
        }
        // Update combinedVarTypes so that inner shadowing declarations
        // take effect for type-based mutability inference (e.g. .balance checks),
        // but do not let a non-address type override a previously address-typed name.
        const existingType = combinedVarTypes.get(stmt.name);
        if (existingType) {
          const existingIsAddressLike =
            existingType.kind === (SkittlesTypeKind.Address);
          const newIsAddressLike =
            stmt.type.kind === (SkittlesTypeKind.Address);
          if (!existingIsAddressLike || newIsAddressLike) {
            combinedVarTypes.set(stmt.name, stmt.type);
          }
        } else {
          combinedVarTypes.set(stmt.name, stmt.type);
        }
      }
    }
  );

  if (usesMsgValue) return "payable";
  if (writesState) return "nonpayable";
  if (readsState || readsEnvironment) return "view";
  return "pure";
}

export const MUTABILITY_RANK: Record<StateMutability, number> = {
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
export function propagateMutability(contracts: SkittlesContract[]): void {
  const contractByName = new Map(contracts.map((c) => [c.name, c]));

  let globalChanged = true;
  while (globalChanged) {
    globalChanged = false;

    for (const contract of contracts) {
      const parentFunctions = new Map<string, SkittlesFunction>();
      for (const parentName of contract.inherits) {
        const parent = contractByName.get(parentName);
        if (!parent) continue;
        for (const f of parent.functions) {
          parentFunctions.set(f.name, f);
        }
      }

      for (const fn of contract.functions) {
        const calledMethods = collectThisCalls(fn.body);
        for (const calledName of calledMethods) {
          const calledFn = contract.functions.find((f) => f.name === calledName) ?? parentFunctions.get(calledName);
          if (!calledFn) continue;
          const calledRank = MUTABILITY_RANK[calledFn.stateMutability];
          const currentRank = MUTABILITY_RANK[fn.stateMutability];
          if (calledRank > currentRank) {
            const rankToMut = ["pure", "view", "nonpayable", "payable"] as const;
            fn.stateMutability = rankToMut[calledRank];
            globalChanged = true;
          }
        }
      }
    }
  }
}

export function collectContractInterfaceTypeRefs(type: SkittlesType, refs: Set<string>): void {
  if (type.kind === (SkittlesTypeKind.ContractInterface) && type.structName) {
    refs.add(type.structName);
  }
  if (type.keyType) collectContractInterfaceTypeRefs(type.keyType, refs);
  if (type.valueType) collectContractInterfaceTypeRefs(type.valueType, refs);
}

export function collectBodyContractInterfaceRefs(stmts: Statement[], refs: Set<string>): void {
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

export function isStateAccess(expr: Expression): boolean {
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

export function isExternalContractCall(expr: { callee: Expression }, varTypes: Map<string, SkittlesType>): boolean {
  if (
    expr.callee.kind === "property-access" &&
    expr.callee.object.kind === "property-access" &&
    expr.callee.object.object.kind === "identifier" &&
    expr.callee.object.object.name === "this"
  ) {
    const propName = expr.callee.object.property;
    const propType = ctx.stateVarTypes.get(propName);
    if (propType && propType.kind === (SkittlesTypeKind.ContractInterface)) {
      return true;
    }
  }
  return false;
}

export function isExternalContractCallOnLocal(expr: { callee: Expression }, localVarTypes: Map<string, SkittlesType>): boolean {
  if (
    expr.callee.kind === "property-access" &&
    expr.callee.object.kind === "identifier" &&
    expr.callee.object.name !== "this"
  ) {
    const varName = expr.callee.object.name;
    const varType = localVarTypes.get(varName);
    if (varType && varType.kind === (SkittlesTypeKind.ContractInterface)) {
      return true;
    }
  }
  return false;
}

/**
 * Look up the stateMutability of the called method for an external contract call.
 * Returns the method's stateMutability if found, or undefined if not resolvable.
 */
export function getExternalCallMethodMutability(
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
    const propType = ctx.stateVarTypes.get(expr.callee.object.property);
    if (propType?.kind === (SkittlesTypeKind.ContractInterface)) {
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
    if (varType?.kind === (SkittlesTypeKind.ContractInterface)) {
      ifaceName = varType.structName;
    }
  }

  if (!ifaceName) return undefined;
  const iface = ctx.knownContractInterfaceMap.get(ifaceName);
  if (!iface) return undefined;
  const method = iface.functions.find(f => f.name === methodName);
  return method?.stateMutability;
}

export function isStateMutatingCall(expr: { callee: Expression }): boolean {
  if (expr.callee.kind !== "property-access") return false;
  const method = expr.callee.property;
  if (!["push", "pop", "remove", "splice", "reverse"].includes(method)) return false;
  return isStateAccess(expr.callee.object);
}

/**
 * Check if the receiver of a property-access is `this` or a contract-interface typed variable.
 * Used to distinguish `addr.transfer(amount)` (ETH transfer) from
 * `this.transfer(...)` or `token.transfer(...)` (contract method calls).
 */
export function isContractInterfaceReceiver(
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
    const propType = ctx.stateVarTypes.get(receiver.property);
    if (propType && propType.kind === (SkittlesTypeKind.ContractInterface)) return true;
  }
  // token.transfer(...) where token is a contract-interface local/param
  if (receiver.kind === "identifier") {
    const localType = localVarTypes?.get(receiver.name);
    if (localType && localType.kind === (SkittlesTypeKind.ContractInterface)) return true;
    const stateType = varTypes?.get(receiver.name);
    if (stateType && stateType.kind === (SkittlesTypeKind.ContractInterface)) return true;
  }
  return false;
}
