import ts from "typescript";
import type {
  SkittlesType,
  SkittlesTypeKind,
  SkittlesParameter,
  Statement,
  Expression,
  EmitStatement,
  ConsoleLogStatement,
  SwitchCase,
} from "../types/index.ts";
import { ctx } from "./parser-context.ts";
import {
  getSourceLine,
  setupStringTracking,
  wrapStringTruthiness,
  validateReservedName,
  validateReservedVarName,
  findEnclosingClass,
  findMethodReturnType,
} from "./parser-utils.ts";
import { parseType, inferType, typesEqual } from "./type-parser.ts";
import { parseExpression } from "./expression-parser.ts";
import { isMappingLikeReceiver } from "./expression-parser.ts";

const UNSUPPORTED_OBJECT_DESTRUCTURING_MSG =
  "Unsupported object destructuring pattern in variable declaration. " +
  "Only simple bindings are allowed, e.g. `{ a }` or `{ prop: name }` " +
  "with no default values, rest elements, computed property names, or nested patterns.";

function validateArrayLiteralElements(elements: ts.NodeArray<ts.Expression>): void {
  for (const arrElem of elements) {
    if (ts.isOmittedExpression(arrElem)) {
      throw new Error("Array literal in destructuring assignment must not contain holes (e.g. [, 2]).");
    }
    if (ts.isSpreadElement(arrElem)) {
      throw new Error("Array literal in destructuring assignment must not contain spread elements.");
    }
  }
}

export function parseArrayDestructuring(
  pattern: ts.ArrayBindingPattern,
  initializer: ts.Expression,
  varTypes: Map<string, SkittlesType>,
  decl: ts.VariableDeclaration
): Statement[] {
  const statements: Statement[] = [];
  const sl = getSourceLine(decl);

  if (ts.isArrayLiteralExpression(initializer)) {
    // Direct array literal: const [a, b, c] = [7, 8, 9]
    // Validate that the array literal has no holes or spread elements
    validateArrayLiteralElements(initializer.elements);
    for (let i = 0; i < pattern.elements.length; i++) {
      const elem = pattern.elements[i];
      if (!ts.isBindingElement(elem)) {
        continue;
      }
      // Only support simple identifier bindings with no defaults, rest, renames, or nested patterns.
      if (
        !ts.isIdentifier(elem.name) ||
        !!elem.initializer ||
        !!elem.dotDotDotToken ||
        !!elem.propertyName
      ) {
        throw new Error(
          "Unsupported array destructuring binding element in variable declaration. " +
          "Only simple identifier bindings are allowed (no default values, rest elements, renames, or nested patterns)."
        );
      }
      const name = elem.name.text;
      validateReservedVarName(name);
      const init = i < initializer.elements.length
        ? parseExpression(initializer.elements[i])
        : undefined;
      const type = init ? inferType(init, varTypes) : undefined;
      // Always clear any previous type/string classification for this binding,
      // so we don't leak outer-scope information into the new declaration.
      varTypes.delete(name);
      ctx.currentStringNames.delete(name);
      if (type) {
        varTypes.set(name, type);
        if (type.kind === ("string" as SkittlesTypeKind)) {
          ctx.currentStringNames.add(name);
        }
      }
      statements.push({ kind: "variable-declaration" as const, name, type, initializer: init, sourceLine: sl });
    }
  } else if (ts.isConditionalExpression(initializer)) {
    // Conditional destructuring: let [a, b] = cond ? [x, y] : [y, x]
    const condition = parseExpression(initializer.condition);

    if (!ts.isArrayLiteralExpression(initializer.whenTrue) || !ts.isArrayLiteralExpression(initializer.whenFalse)) {
      throw new Error("Conditional array destructuring requires array literals in both branches.");
    }

    // Validate that the array literals in both branches have no holes or spread elements
    validateArrayLiteralElements(initializer.whenTrue.elements);
    validateArrayLiteralElements(initializer.whenFalse.elements);

    const trueExprs: Expression[] = initializer.whenTrue.elements.map(parseExpression);
    const falseExprs: Expression[] = initializer.whenFalse.elements.map(parseExpression);

    for (let i = 0; i < pattern.elements.length; i++) {
      const elem = pattern.elements[i];
      if (!ts.isBindingElement(elem)) {
        continue;
      }
      // Only support simple identifier bindings with no defaults, rest, renames, or nested patterns.
      if (
        !ts.isIdentifier(elem.name) ||
        !!elem.initializer ||
        !!elem.dotDotDotToken ||
        !!elem.propertyName
      ) {
        throw new Error(
          "Unsupported array destructuring binding element in variable declaration. " +
          "Only simple identifier bindings are allowed (no default values, rest elements, renames, or nested patterns)."
        );
      }
      const name = elem.name.text;
      validateReservedVarName(name);
      const trueVal = i < trueExprs.length ? trueExprs[i] : { kind: "number-literal" as const, value: "0" };
      const falseVal = i < falseExprs.length ? falseExprs[i] : { kind: "number-literal" as const, value: "0" };
      const init: Expression = { kind: "conditional", condition, whenTrue: trueVal, whenFalse: falseVal };
      const trueType = inferType(trueVal, varTypes);
      const falseType = inferType(falseVal, varTypes);
      const type = (trueType && falseType && typesEqual(trueType, falseType)) ? trueType : undefined;
      // Always clear any previous type/string classification for this binding,
      // so we don't leak outer-scope information into the new declaration.
      varTypes.delete(name);
      ctx.currentStringNames.delete(name);
      if (type) {
        varTypes.set(name, type);
        if (type.kind === ("string" as SkittlesTypeKind)) {
          ctx.currentStringNames.add(name);
        }
      }
      statements.push({ kind: "variable-declaration" as const, name, type, initializer: init, sourceLine: sl });
    }
  } else if (ts.isCallExpression(initializer)) {
    // Tuple destructuring from function call: const [a, b] = this.getReserves()
    let tupleType: SkittlesType | undefined;

    // Check explicit type annotation first
    if (decl.type) {
      tupleType = parseType(decl.type);
    }

    // If no explicit type, try to resolve from a this.method() call
    if (!tupleType) {
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
            tupleType = parseType(retTypeNode);
          }
        }
      }
    }

    if (tupleType?.kind === ("tuple" as SkittlesTypeKind) && tupleType.tupleTypes) {
      const tupleArity = tupleType.tupleTypes.length;
      const names: (string | null)[] = [];
      const types: (SkittlesType | null)[] = [];
      for (let i = 0; i < pattern.elements.length; i++) {
        const elem = pattern.elements[i];
        if (i >= tupleArity) {
          throw new Error(
            "Tuple destructuring pattern has more elements than the function's tuple return type."
          );
        }
        if (ts.isOmittedExpression(elem)) {
          // Skipped element: const [, b] = f()
          names.push(null);
          types.push(tupleType.tupleTypes[i]);
        } else if (
          ts.isBindingElement(elem) &&
          ts.isIdentifier(elem.name) &&
          !elem.initializer &&
          !elem.dotDotDotToken &&
          !elem.propertyName
        ) {
          const bindingName = elem.name.text;
          validateReservedVarName(bindingName);
          names.push(bindingName);
          const t = tupleType.tupleTypes[i];
          types.push(t);
          varTypes.set(bindingName, t);
          if (t && t.kind === ("string" as SkittlesTypeKind)) {
            ctx.currentStringNames.add(bindingName);
          } else {
            ctx.currentStringNames.delete(bindingName);
          }
        } else if (ts.isBindingElement(elem)) {
          throw new Error(
            "Unsupported tuple destructuring binding element in variable declaration. " +
            "Nested patterns, default values in tuple destructuring (e.g. [a = 1]), and rest elements are not supported."
          );
        } else {
          throw new Error(
            "Unsupported element in tuple destructuring assignment. " +
            "Only simple identifiers and omitted elements are supported in tuple destructuring patterns."
          );
        }
      }
      // Pad with null entries for trailing tuple positions not covered by the
      // binding pattern, so Solidity gets the correct tuple arity on the LHS.
      for (let i = pattern.elements.length; i < tupleArity; i++) {
        names.push(null);
        types.push(tupleType.tupleTypes[i]);
      }
      const initExpr = parseExpression(initializer);
      return [{
        kind: "tuple-destructuring" as const,
        names,
        types,
        initializer: initExpr,
        sourceLine: sl,
      }];
    }

    // Unable to resolve tuple return type – emit a compile-time error rather than
    // silently generating uninitialized locals with default Solidity values.
    throw new Error(
      "Unable to resolve tuple return type for call expression in destructuring assignment. " +
      "Ensure the called function has an explicit tuple return type annotation."
    );
  } else {
    // Unsupported initializer form for array destructuring.
    // To avoid changing semantics (TS destructuring assigns from the initializer),
    // we reject non-literal / non-conditional / non-call initializers instead of
    // emitting uninitialized variable declarations.
    throw new Error(
      "Unsupported initializer in array destructuring variable declaration. " +
      "Only array literals, conditional expressions, or function calls with tuple return types are supported."
    );
  }

  return statements;
}

export function parseObjectDestructuring(
  pattern: ts.ObjectBindingPattern,
  initializer: ts.Expression,
  varTypes: Map<string, SkittlesType>,
  decl: ts.VariableDeclaration
): Statement[] {
  const statements: Statement[] = [];
  const sl = getSourceLine(decl);

  if (ts.isObjectLiteralExpression(initializer)) {
    // Direct object literal: const { a, b } = { a: 1, b: 2 } or { a, b }
    const propMap = new Map<string, ts.Expression>();
    for (const prop of initializer.properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
        propMap.set(prop.name.text, prop.initializer);
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        const name = prop.name.text;
        const valueExpr =
          prop.objectAssignmentInitializer ??
          ts.factory.createIdentifier(name);
        propMap.set(name, valueExpr);
      }
    }

    for (const elem of pattern.elements) {
      if (!ts.isBindingElement(elem)) {
        continue;
      }

      // Only support simple bindings: { a } or { prop: a } with identifiers only,
      // and no defaults, rest elements, or nested patterns.
      if (
        !ts.isIdentifier(elem.name) ||
        (!!elem.propertyName && !ts.isIdentifier(elem.propertyName)) ||
        !!elem.initializer ||
        !!elem.dotDotDotToken
      ) {
        throw new Error(UNSUPPORTED_OBJECT_DESTRUCTURING_MSG);
      }

      const name = (elem.name as ts.Identifier).text;
      validateReservedVarName(name);
      const propName =
        elem.propertyName && ts.isIdentifier(elem.propertyName)
          ? elem.propertyName.text
          : name;
      const init = propMap.has(propName)
        ? parseExpression(propMap.get(propName)!)
        : undefined;
      const type = init ? inferType(init, varTypes) : undefined;
      // Always clear any previous type/string classification for this binding,
      // so we don't leak outer-scope information into the new declaration.
      varTypes.delete(name);
      ctx.currentStringNames.delete(name);
      if (type) {
        varTypes.set(name, type);
        if (type.kind === ("string" as SkittlesTypeKind)) {
          ctx.currentStringNames.add(name);
        }
      }
      statements.push({
        kind: "variable-declaration" as const,
        name,
        type,
        initializer: init,
        sourceLine: sl,
      });
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
    // Temp variable + field accesses (use __sk_ prefix + counter to avoid collisions)
    const tempName = `__sk_${structType.structName.charAt(0).toLowerCase()}${structType.structName.slice(1)}_${ctx.destructureCounter++}`;
    statements.push({
      kind: "variable-declaration" as const,
      name: tempName,
      type: structType,
      initializer: initExpr,
      sourceLine: sl,
    });

    const fieldMap = new Map<string, SkittlesType>();
    if (structType.structFields) {
      for (const f of structType.structFields) {
        fieldMap.set(f.name, f.type);
      }
    }

    for (const elem of pattern.elements) {
      if (!ts.isBindingElement(elem)) {
        continue;
      }
      if (
        !ts.isIdentifier(elem.name) ||
        (!!elem.propertyName && !ts.isIdentifier(elem.propertyName)) ||
        !!elem.initializer ||
        !!elem.dotDotDotToken
      ) {
        throw new Error(UNSUPPORTED_OBJECT_DESTRUCTURING_MSG);
      }
      const name = (elem.name as ts.Identifier).text;
      validateReservedVarName(name);
      const propName =
        elem.propertyName && ts.isIdentifier(elem.propertyName)
          ? elem.propertyName.text
          : name;
      const fieldType = fieldMap.get(propName);
      if (!fieldType) {
        const validFields = [...fieldMap.keys()].join(", ");
        throw new Error(
          `Property '${propName}' does not exist on struct '${structType.structName}'. ` +
          `Valid fields: ${validFields || "(none)"}`
        );
      }
      varTypes.set(name, fieldType);
      if (fieldType.kind === ("string" as SkittlesTypeKind)) {
        ctx.currentStringNames.add(name);
      } else {
        ctx.currentStringNames.delete(name);
      }
      statements.push({
        kind: "variable-declaration" as const,
        name,
        type: fieldType,
        initializer: {
          kind: "property-access" as const,
          object: { kind: "identifier" as const, name: tempName },
          property: propName,
        },
        sourceLine: sl,
      });
    }
  } else {
    // Fallback: property-access expressions directly on the initializer.
    // To avoid re-evaluating the initializer for each binding (which would
    // change semantics for call expressions or other side-effectful expressions),
    // only allow simple, side-effect-free initializers (identifiers and
    // property-access chains like this.field).
    if (
      !ts.isIdentifier(initializer) &&
      !ts.isPropertyAccessExpression(initializer) &&
      !(initializer.kind === ts.SyntaxKind.ThisKeyword)
    ) {
      throw new Error(
        "Unsupported initializer in object destructuring variable declaration. " +
        "Only identifiers and property accesses are supported in the fallback path " +
        "to avoid re-evaluating side-effectful expressions for each binding."
      );
    }
    for (const elem of pattern.elements) {
      if (!ts.isBindingElement(elem)) {
        continue;
      }
      if (
        !ts.isIdentifier(elem.name) ||
        (!!elem.propertyName && !ts.isIdentifier(elem.propertyName)) ||
        !!elem.initializer ||
        !!elem.dotDotDotToken
      ) {
        throw new Error(UNSUPPORTED_OBJECT_DESTRUCTURING_MSG);
      }
      const name = (elem.name as ts.Identifier).text;
      validateReservedVarName(name);
      const propName =
        elem.propertyName && ts.isIdentifier(elem.propertyName)
          ? elem.propertyName.text
          : name;
      const propAccessInit: Expression = {
        kind: "property-access" as const,
        object: initExpr,
        property: propName,
      };
      const type = inferType(propAccessInit, varTypes);
      // Clear any previous type/string classification for this binding,
      // so we don't leak outer-scope information into the new declaration.
      varTypes.delete(name);
      ctx.currentStringNames.delete(name);
      if (type) {
        varTypes.set(name, type);
        if (type.kind === ("string" as SkittlesTypeKind)) {
          ctx.currentStringNames.add(name);
        }
      }
      statements.push({
        kind: "variable-declaration" as const,
        name,
        type,
        initializer: propAccessInit,
        sourceLine: sl,
      });
    }
  }

  return statements;
}


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

    validateReservedVarName(name);

    const explicitType = decl.type ? parseType(decl.type) : undefined;
    const initializer = decl.initializer
      ? parseExpression(decl.initializer)
      : undefined;
    const type =
      explicitType || (initializer ? inferType(initializer, varTypes) : undefined);

    if (type?.kind === ("string" as SkittlesTypeKind)) {
      ctx.currentStringNames.add(name);
    } else {
      ctx.currentStringNames.delete(name);
    }
    // Always update varTypes so that identifier-based type inference
    // reflects the current in-scope binding, even when a local
    // shadows a state variable. State-variable-specific consumers
    // should rely on ctx.stateVarTypes when needed.
    if (type) {
      varTypes.set(name, type);
    } else {
      // If we cannot infer a type (no explicit type and no initializer),
      // remove any previous entry to avoid stale type information.
      varTypes.delete(name);
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
    const condition = wrapStringTruthiness(parseExpression(node.expression));
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

    // Use loop-scoped varTypes so the loop variable is available inside
    // the condition, incrementor, and body, but doesn't leak outside.
    const loopVarTypes = new Map(varTypes);

    if (node.initializer) {
      if (ts.isVariableDeclarationList(node.initializer)) {
        const decl = node.initializer.declarations[0];
        const n = ts.isIdentifier(decl.name) ? decl.name.text : "unknown";
        validateReservedVarName(n);
        const t = decl.type ? parseType(decl.type) : undefined;
        const init = decl.initializer
          ? parseExpression(decl.initializer)
          : undefined;
        const resolvedType = t || (init ? inferType(init, varTypes) : undefined);
        initializer = {
          kind: "variable-declaration",
          name: n,
          type: resolvedType,
          initializer: init,
        };
        if (resolvedType) {
          loopVarTypes.set(n, resolvedType);
        } else {
          // If there is no resolved type for the loop variable, ensure we
          // do not inherit any outer-scope type for the same name.
          loopVarTypes.delete(n);
        }
      } else {
        initializer = {
          kind: "expression",
          expression: parseExpression(node.initializer),
        };
      }
    }

    // Temporarily switch parser context to the loop-scoped var types so
    // that condition, incrementor, and body expressions see the loop variable.
    const previousVarTypes = ctx.currentVarTypes;
    const previousStringNames = ctx.currentStringNames;
    const loopStringNames = new Set(previousStringNames);
    // Track loop initializer variable for string transforms if needed.
    // If the loop initializer declares a variable that shadows an outer
    // string variable, make sure we only keep the name in loopStringNames
    // when the loop-scoped variable is actually a string.
    if (node.initializer && ts.isVariableDeclarationList(node.initializer)) {
      const decl = node.initializer.declarations[0];
      if (ts.isIdentifier(decl.name)) {
        const name = decl.name.text;
        const resolvedType = loopVarTypes.get(name);
        // Remove any outer tracking for this name; re-add only if string.
        loopStringNames.delete(name);
        if (resolvedType?.kind === ("string" as SkittlesTypeKind)) {
          loopStringNames.add(name);
        }
      }
    }
    ctx.currentVarTypes = loopVarTypes;
    ctx.currentStringNames = loopStringNames;

    let result: Statement;
    try {
      result = {
        kind: "for",
        initializer,
        condition: node.condition
          ? wrapStringTruthiness(parseExpression(node.condition))
          : undefined,
        incrementor: node.incrementor
          ? parseExpression(node.incrementor)
          : undefined,
        body: parseBlock(node.statement, loopVarTypes, eventNames),
        sourceLine: getSourceLine(node),
      };
    } finally {
      // Restore outer parser context even if parsing throws
      ctx.currentVarTypes = previousVarTypes;
      ctx.currentStringNames = previousStringNames;
    }

    return result;
  }

  if (ts.isWhileStatement(node)) {
    return {
      kind: "while",
      condition: wrapStringTruthiness(parseExpression(node.expression)),
      body: parseBlock(node.statement, varTypes, eventNames),
      sourceLine: getSourceLine(node),
    };
  }

  if (ts.isDoStatement(node)) {
    return {
      kind: "do-while",
      condition: wrapStringTruthiness(parseExpression(node.expression)),
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

    validateReservedVarName(itemName);

    const explicitType = ts.isVariableDeclarationList(node.initializer) && node.initializer.declarations[0].type
      ? parseType(node.initializer.declarations[0].type)
      : undefined;

    // When no explicit type annotation, infer element type from the iterated expression
    const itemTypeNode = explicitType ?? (() => {
      const arrType = inferType(arrExpr, varTypes);
      if (arrType?.kind === ("array" as SkittlesTypeKind) && arrType.valueType) {
        return arrType.valueType;
      }
      return undefined;
    })();

    const indexName = `__sk_i_${itemName}`;
    const loopVarTypes = new Map(varTypes);
    if (itemTypeNode) {
      loopVarTypes.set(itemName, itemTypeNode);
    }
    loopVarTypes.set(indexName, { kind: "uint256" as SkittlesTypeKind });

    // Temporarily switch parser context to loop-scoped var types
    const previousVarTypes = ctx.currentVarTypes;
    const previousStringNames = ctx.currentStringNames;
    const loopStringNames = new Set(previousStringNames);
    // Shadowing: ensure any outer string classification for `itemName` doesn't leak into the loop scope
    loopStringNames.delete(itemName);
    if (itemTypeNode && itemTypeNode.kind === ("string" as SkittlesTypeKind)) {
      loopStringNames.add(itemName);
    }
    let innerBody: Statement[];
    try {
      ctx.currentVarTypes = loopVarTypes;
      ctx.currentStringNames = loopStringNames;
      innerBody = parseBlock(node.statement, loopVarTypes, eventNames);
    } finally {
      // Restore outer parser context even if parseBlock throws
      ctx.currentVarTypes = previousVarTypes;
      ctx.currentStringNames = previousStringNames;
    }

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
    const enumMembers = ctx.knownEnums.get(enumName);

    if (enumMembers) {
      const itemName = ts.isVariableDeclarationList(node.initializer)
        ? (ts.isIdentifier(node.initializer.declarations[0].name) ? node.initializer.declarations[0].name.text : "_item")
        : "_item";

      validateReservedVarName(itemName);

      const indexName = `__sk_i_${itemName}`;
      const loopVarTypes = new Map(varTypes);
      loopVarTypes.set(itemName, { kind: "enum" as SkittlesTypeKind, structName: enumName });
      loopVarTypes.set(indexName, { kind: "uint256" as SkittlesTypeKind });

      // Temporarily switch parser context to loop-scoped var types
      const previousVarTypes = ctx.currentVarTypes;
      const previousStringNames = ctx.currentStringNames;
      const loopStringNames = new Set(previousStringNames);
      // Shadowing: ensure any outer string classification for `itemName` doesn't leak into the loop scope
      loopStringNames.delete(itemName);
      let innerBody: Statement[];
      try {
        ctx.currentVarTypes = loopVarTypes;
        ctx.currentStringNames = loopStringNames;
        innerBody = parseBlock(node.statement, loopVarTypes, eventNames);
      } finally {
        // Restore outer parser context even if parseBlock throws
        ctx.currentVarTypes = previousVarTypes;
        ctx.currentStringNames = previousStringNames;
      }

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
        sourceLine: getSourceLine(node),
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
      if (returnVarName) {
        validateReservedVarName(returnVarName);
      }
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

      if (errorName !== "Error" && ctx.knownCustomErrors.has(errorName)) {
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
        if (ctx.knownCustomErrors.has(errorName)) {
          const args = node.expression.arguments.map(parseExpression);
          return { kind: "revert", customError: errorName, customErrorArgs: args, sourceLine: getSourceLine(node) };
        }
      }
    }

    return { kind: "revert", sourceLine: getSourceLine(node) };
  }

  throw new Error(`Unsupported statement: ${ts.SyntaxKind[node.kind]}`);
}

export function parseBlock(
  node: ts.Statement,
  varTypes: Map<string, SkittlesType>,
  eventNames: Set<string> = new Set()
): Statement[] {
  if (ts.isBlock(node)) {
    // Snapshot outer scope so block-scoped declarations don't leak.
    const savedVarTypes = new Map(varTypes);
    const savedStringNames = new Set(ctx.currentStringNames);
    try {
      const result = node.statements.flatMap((s) => parseStatements(s, varTypes, eventNames));
      return result;
    } finally {
      // Restore outer scope: undo any varTypes mutations made inside the block.
      varTypes.clear();
      for (const [k, v] of savedVarTypes) varTypes.set(k, v);
      ctx.currentStringNames = savedStringNames;
    }
  }
  return parseStatements(node, varTypes, eventNames);
}

/**
 * Parse a single TS statement into one or more IR statements.
 * Multi-declaration variable statements (let a=1, b=2) expand to multiple.
 */
export function parseStatements(
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

        validateReservedVarName(name);

        const explicitType = decl.type ? parseType(decl.type) : undefined;
        const initializer = decl.initializer
          ? parseExpression(decl.initializer)
          : undefined;
        const type =
          explicitType || (initializer ? inferType(initializer, varTypes) : undefined);
        if (type?.kind === ("string" as SkittlesTypeKind)) {
          ctx.currentStringNames.add(name);
        } else {
          ctx.currentStringNames.delete(name);
        }
        // Locals (including those that shadow state variables) should
        // always update varTypes. Passes that need state-only resolution
        // should consult ctx.stateVarTypes instead of relying on varTypes.
        if (type) {
          varTypes.set(name, type);
        } else {
          // Clear any previous mapping to avoid stale types when no type can be inferred.
          varTypes.delete(name);
        }
        return { kind: "variable-declaration" as const, name, type, initializer, sourceLine: sl };
      });
    }

    // Array destructuring: const [a, b, c] = [7, 8, 9]
    const decl = node.declarationList.declarations[0];
    if (decl.name && ts.isArrayBindingPattern(decl.name) && decl.initializer) {
      return parseArrayDestructuring(decl.name, decl.initializer, varTypes, decl);
    }

    // Object destructuring: const { a, b } = { a: 1, b: 2 }
    if (decl.name && ts.isObjectBindingPattern(decl.name) && decl.initializer) {
      return parseObjectDestructuring(decl.name, decl.initializer, varTypes, decl);
    }

    // Explicitly reject unsupported destructuring without initializer,
    // instead of falling through to parseStatement and creating an "unknown" variable.
    if (
      decl.name &&
      (ts.isArrayBindingPattern(decl.name) || ts.isObjectBindingPattern(decl.name)) &&
      !decl.initializer
    ) {
      throw new Error(
        "Unsupported destructuring variable declaration without initializer: " +
          getSourceLine(decl)
      );
    }
  }
  return [parseStatement(node, varTypes, eventNames)];
}

// ============================================================
// Emit detection: this.EventName.emit(args) or this.EventName.emit({...})
// ============================================================

export function tryParseEmitStatement(
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

export function tryParseConsoleLog(
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
