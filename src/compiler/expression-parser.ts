import ts from "typescript";
import {
  SkittlesTypeKind,
  type SkittlesType,
  type SkittlesFunction,
  type SkittlesParameter,
  type Statement,
  type Expression,
} from "../types/index.ts";
import { ctx } from "./parser-context.ts";
import {
  isStringExpr,
  STRING_RETURNING_HELPERS,
  STRING_METHODS,
  KNOWN_ARRAY_METHODS,
  describeExpectedArgs,
  wrapStringTruthiness,
  validateReservedName,
  validateReservedVarName,
  findEnclosingClass,
  findMethodReturnType,
  mkId,
  mkNum,
  mkProp,
  mkElem,
  mkBin,
  mkAssign,
  mkIncr,
  mkDecr,
  mkVarDecl,
  mkExprStmt,
  mkReturn,
  mkIf,
  mkForLoop,
  UINT256_TYPE,
  INT256_TYPE,
  BOOL_TYPE,
  getBinaryOperator,
  isAssignmentOperator,
  getUnaryOperator,
  defaultValueForType,
  getArrayHelperSuffix,
  typeToSolidityName,
  identifierSafeType,
  collectBareIdentifiers,
  collectBareIdentifiersFromStmts,
  validateCallbackScope,
  getNodeName,
} from "./parser-utils.ts";
import { parseType, inferType } from "./type-parser.ts";
import { inferStateMutability } from "./mutability.ts";
import { parseStatement, parseStatements } from "./statement-parser.ts";

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
    // undefined → 0 (Solidity zero value)
    if (node.text === "undefined") {
      return { kind: "number-literal", value: "0" };
    }
    // Inline file level constants
    const constExpr = ctx.fileConstants.get(node.text);
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

  // undefined → 0 (Solidity zero value) — covers UndefinedKeyword token
  if (node.kind === ts.SyntaxKind.UndefinedKeyword) {
    return { kind: "number-literal", value: "0" };
  }

  if (ts.isPropertyAccessExpression(node)) {
    const object = parseExpression(node.expression);
    const property = ts.isPrivateIdentifier(node.name)
      ? node.name.text.replace(/^#/, "")
      : node.name.text;

    // string.length → bytes(str).length
    if (property === "length" && isStringExpr(object)) {
      return {
        kind: "property-access",
        object: {
          kind: "call",
          callee: { kind: "identifier", name: "bytes" },
          args: [object],
        },
        property: "length",
      };
    }

    return { kind: "property-access", object, property };
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

    // Desugar ?? to ternary: x ?? y → (x == defaultZero ? y : x)
    // Solidity has no null/undefined; all types have default zero values.
    // The left operand is parsed once to avoid duplicating side effects.
    if (opKind === ts.SyntaxKind.QuestionQuestionToken) {
      const leftExpr = parseExpression(node.left);
      const right = parseExpression(node.right);
      const leftType = inferType(leftExpr, ctx.currentVarTypes);
      const zeroValue = defaultValueForType(leftType) ?? {
        kind: "number-literal" as const,
        value: "0",
      };
      return {
        kind: "conditional",
        condition: {
          kind: "binary",
          operator: "==",
          left: leftExpr,
          right: zeroValue,
        },
        whenTrue: right,
        whenFalse: leftExpr,
      };
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

    const left = parseExpression(node.left);
    const right = parseExpression(node.right);

    // String comparison: str === other → keccak256(str) == keccak256(other)
    if (
      (operator === "==" || operator === "!=") &&
      (isStringExpr(left) || isStringExpr(right))
    ) {
      return {
        kind: "binary",
        operator,
        left: {
          kind: "call",
          callee: { kind: "identifier", name: "keccak256" } as Expression,
          args: [left],
        },
        right: {
          kind: "call",
          callee: { kind: "identifier", name: "keccak256" } as Expression,
          args: [right],
        },
      };
    }

    return {
      kind: "binary",
      operator,
      left,
      right,
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
    // Map.get(key) → mapping[key]
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "get" &&
      node.arguments.length === 1 &&
      isMappingLikeReceiver(node.expression.expression)
    ) {
      return {
        kind: "element-access" as const,
        object: parseExpression(node.expression.expression),
        index: parseExpression(node.arguments[0]),
      };
    }

    // Map.has(key) → mapping[key] != <default>
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "has" &&
      node.arguments.length === 1 &&
      isMappingLikeReceiver(node.expression.expression)
    ) {
      const valueType = resolveMappingValueType(node.expression.expression);
      const defaultExpr = defaultValueForType(valueType);
      if (!defaultExpr) {
        throw new Error(
          "Map.has(key) is not supported for this mapping value type. " +
            "Please use an explicit comparison against the mapping's default value."
        );
      }
      return {
        kind: "binary" as const,
        operator: "!=",
        left: {
          kind: "element-access" as const,
          object: parseExpression(node.expression.expression),
          index: parseExpression(node.arguments[0]),
        },
        right: defaultExpr,
      };
    }

    // Array method calls on storage arrays
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      isArrayLikeReceiver(node.expression.expression)
    ) {
      const methodName = node.expression.name.text;
      const elementType = resolveArrayElementType(node.expression.expression);
      const receiverExpr = parseExpression(node.expression.expression);
      const typeSuffix = getArrayHelperSuffix(elementType);

      const NON_COMPARABLE_KINDS = new Set([
        SkittlesTypeKind.Struct,
        SkittlesTypeKind.Array,
        SkittlesTypeKind.Tuple,
        SkittlesTypeKind.Mapping,
      ]);
      const isNonComparable =
        elementType != null && NON_COMPARABLE_KINDS.has(elementType.kind);

      // includes(value) → _arrIncludes_T(arr, value)
      if (methodName === "includes" && node.arguments.length === 1) {
        if (isNonComparable)
          throw new Error(
            `Unsupported: .includes() on ${typeSuffix}[] arrays. Element type does not support equality in Solidity. Use .some() with a callback instead.`
          );
        ctx.neededArrayHelpers.add(`includes_${typeSuffix}`);
        return {
          kind: "call" as const,
          callee: {
            kind: "identifier" as const,
            name: `_arrIncludes_${typeSuffix}`,
          },
          args: [receiverExpr, parseExpression(node.arguments[0])],
        };
      }

      // indexOf(value) → _arrIndexOf_T(arr, value)
      if (methodName === "indexOf" && node.arguments.length === 1) {
        if (isNonComparable)
          throw new Error(
            `Unsupported: .indexOf() on ${typeSuffix}[] arrays. Element type does not support equality in Solidity. Use .findIndex() with a callback instead.`
          );
        ctx.neededArrayHelpers.add(`indexOf_${typeSuffix}`);
        return {
          kind: "call" as const,
          callee: {
            kind: "identifier" as const,
            name: `_arrIndexOf_${typeSuffix}`,
          },
          args: [receiverExpr, parseExpression(node.arguments[0])],
        };
      }

      // lastIndexOf(value) → _arrLastIndexOf_T(arr, value)
      if (methodName === "lastIndexOf" && node.arguments.length === 1) {
        if (isNonComparable)
          throw new Error(
            `Unsupported: .lastIndexOf() on ${typeSuffix}[] arrays. Element type does not support equality in Solidity.`
          );
        ctx.neededArrayHelpers.add(`lastIndexOf_${typeSuffix}`);
        return {
          kind: "call" as const,
          callee: {
            kind: "identifier" as const,
            name: `_arrLastIndexOf_${typeSuffix}`,
          },
          args: [receiverExpr, parseExpression(node.arguments[0])],
        };
      }

      // at(index) → arr[index] with negative index support
      if (methodName === "at" && node.arguments.length === 1) {
        const indexArg = node.arguments[0];
        if (
          ts.isPrefixUnaryExpression(indexArg) &&
          indexArg.operator === ts.SyntaxKind.MinusToken
        ) {
          if (ts.isNumericLiteral(indexArg.operand)) {
            if (Number(indexArg.operand.text) === 0) {
              return mkElem(receiverExpr, mkNum("0"));
            }
            return mkElem(
              receiverExpr,
              mkBin(
                mkProp(receiverExpr, "length"),
                "-",
                mkNum(indexArg.operand.text)
              )
            );
          }
          throw new Error(
            "Array .at() only supports negative numeric literals (e.g., .at(-1)). Non-literal negative indices would produce invalid uint256 values in Solidity."
          );
        }
        return mkElem(receiverExpr, parseExpression(indexArg));
      }

      // slice(start?, end?) → _arrSlice_T(arr, start, end)
      if (methodName === "slice") {
        if (node.arguments.length > 2)
          throw new Error(
            "Array .slice() accepts at most 2 arguments: .slice(start?, end?)."
          );
        for (const arg of node.arguments) {
          if (
            ts.isPrefixUnaryExpression(arg) &&
            arg.operator === ts.SyntaxKind.MinusToken
          ) {
            throw new Error(
              "Array .slice() does not support negative indices. Solidity uses uint256 for array indices."
            );
          }
        }
        ctx.neededArrayHelpers.add(`slice_${typeSuffix}`);
        const startArg =
          node.arguments.length >= 1
            ? parseExpression(node.arguments[0])
            : mkNum("0");
        const endArg =
          node.arguments.length >= 2
            ? parseExpression(node.arguments[1])
            : mkProp(receiverExpr, "length");
        return {
          kind: "call" as const,
          callee: {
            kind: "identifier" as const,
            name: `_arrSlice_${typeSuffix}`,
          },
          args: [receiverExpr, startArg, endArg],
        };
      }

      // concat(other) → _arrConcat_T(arr, other)
      if (methodName === "concat" && node.arguments.length === 1) {
        const otherArg = node.arguments[0];
        if (
          ts.isPropertyAccessExpression(otherArg) &&
          otherArg.expression.kind === ts.SyntaxKind.ThisKeyword
        ) {
          const otherType = ctx.currentVarTypes.get(otherArg.name.text);
          if (otherType?.kind === SkittlesTypeKind.Array) {
            throw new Error(
              "Array .concat() cannot accept a storage array directly (e.g., this.a.concat(this.b)). " +
                "Use .slice() to copy to memory first: this.a.concat(this.b.slice(0, this.b.length))."
            );
          }
        }
        ctx.neededArrayHelpers.add(`concat_${typeSuffix}`);
        return {
          kind: "call" as const,
          callee: {
            kind: "identifier" as const,
            name: `_arrConcat_${typeSuffix}`,
          },
          args: [receiverExpr, parseExpression(otherArg)],
        };
      }

      // sort with no arguments: dedicated error
      if (methodName === "sort" && node.arguments.length === 0) {
        throw new Error(
          "Array .sort() requires a comparator callback: .sort((a, b) => a - b)."
        );
      }

      // Callback-based methods: filter, map, forEach, some, every, find, findIndex, reduce, sort
      if (
        [
          "filter",
          "map",
          "forEach",
          "some",
          "every",
          "find",
          "findIndex",
          "reduce",
          "sort",
        ].includes(methodName) &&
        node.arguments.length >= 1
      ) {
        const maxArity = methodName === "reduce" ? 2 : 1;
        if (node.arguments.length > maxArity) {
          throw new Error(
            `Array .${methodName}() accepts at most ${maxArity} argument(s), but ${node.arguments.length} were provided.`
          );
        }
        const sortParamType =
          methodName === "sort" &&
          elementType?.kind === SkittlesTypeKind.Uint256
            ? INT256_TYPE
            : elementType;
        const callbackParamTypes =
          methodName === "reduce"
            ? { first: undefined, second: elementType }
            : methodName === "sort"
              ? { first: sortParamType, second: sortParamType }
              : { first: elementType };
        const callback = parseArrowCallback(
          node.arguments[0],
          callbackParamTypes
        );
        if (!callback) {
          throw new Error(
            `Array .${methodName}() requires an arrow function callback.`
          );
        }
        {
          const condExpr = callback.bodyExpr;

          if (!condExpr && methodName !== "forEach") {
            throw new Error(
              `Array .${methodName}() requires an arrow function with an expression body (e.g., v => v > 10). Block-bodied callbacks are only supported for .forEach().`
            );
          }

          {
            const allowedNames = new Set<string>([callback.paramName]);
            if (callback.secondParamName)
              allowedNames.add(callback.secondParamName);
            validateCallbackScope(
              condExpr ?? null,
              callback.bodyStmts,
              allowedNames,
              methodName
            );
          }

          // Helper to create a this._helperName() call for mutability propagation
          const mkHelperCall = (name: string): Expression => ({
            kind: "call" as const,
            callee: mkProp(mkId("this"), name),
            args: [],
          });

          if (methodName === "filter" && condExpr) {
            const helper = generateFilterHelper(
              receiverExpr,
              elementType,
              callback.paramName,
              condExpr
            );
            ctx.generatedArrayFunctions.push(helper);
            return mkHelperCall(helper.name);
          }

          if (methodName === "map" && condExpr) {
            const callbackEnv = new Map(ctx.currentVarTypes);
            if (callback.paramName && elementType)
              callbackEnv.set(callback.paramName, elementType);
            const resultType = inferType(condExpr, callbackEnv);
            const helper = generateMapHelper(
              receiverExpr,
              elementType,
              callback.paramName,
              condExpr,
              resultType
            );
            ctx.generatedArrayFunctions.push(helper);
            return mkHelperCall(helper.name);
          }

          if (methodName === "some" && condExpr) {
            const helper = generateSomeEveryHelper(
              "some",
              receiverExpr,
              elementType,
              callback.paramName,
              condExpr
            );
            ctx.generatedArrayFunctions.push(helper);
            return mkHelperCall(helper.name);
          }

          if (methodName === "every" && condExpr) {
            const helper = generateSomeEveryHelper(
              "every",
              receiverExpr,
              elementType,
              callback.paramName,
              condExpr
            );
            ctx.generatedArrayFunctions.push(helper);
            return mkHelperCall(helper.name);
          }

          if (methodName === "find" && condExpr) {
            const helper = generateFindHelper(
              receiverExpr,
              elementType,
              callback.paramName,
              condExpr
            );
            ctx.generatedArrayFunctions.push(helper);
            return mkHelperCall(helper.name);
          }

          if (methodName === "findIndex" && condExpr) {
            const helper = generateFindIndexHelper(
              receiverExpr,
              elementType,
              callback.paramName,
              condExpr
            );
            ctx.generatedArrayFunctions.push(helper);
            return mkHelperCall(helper.name);
          }

          if (methodName === "reduce") {
            if (!callback.secondParamName)
              throw new Error(
                "Array .reduce() callback must have two parameters: (accumulator, item) => expression."
              );
            if (node.arguments.length < 2)
              throw new Error(
                "Array .reduce() requires an initial value as the second argument."
              );
            const initialValue = parseExpression(node.arguments[1]);
            const accType = inferType(initialValue, ctx.currentVarTypes);
            const helper = generateReduceHelper(
              receiverExpr,
              elementType,
              callback.paramName,
              callback.secondParamName,
              condExpr!,
              initialValue,
              accType
            );
            ctx.generatedArrayFunctions.push(helper);
            return mkHelperCall(helper.name);
          }

          // sort: in-place insertion sort using comparator (statement-only like reverse)
          if (methodName === "sort" && condExpr) {
            if (!callback.secondParamName)
              throw new Error(
                "Array .sort() callback must have two parameters: (a, b) => expression."
              );
            if (callback.paramName === callback.secondParamName) {
              throw new Error(
                "Array .sort() callback parameters must have distinct names, e.g. (a, b) => expression. Using the same identifier for both parameters would generate invalid Solidity."
              );
            }
            if (node.parent && !ts.isExpressionStatement(node.parent)) {
              throw new Error(
                "Array .sort() modifies the array in place and does not return a value. Use it as a standalone statement."
              );
            }
            const sortElemKind = elementType?.kind as string | undefined;
            if (
              sortElemKind &&
              sortElemKind !== "uint256" &&
              sortElemKind !== "int256"
            ) {
              throw new Error(
                `Array .sort() is only supported on number[] (uint256) and int256[] arrays. Got ${typeSuffix}[] instead.`
              );
            }
            // Validate comparator return type: must be an integer, not a boolean.
            // The generated helper compares the result to 0 (comparatorExpr > 0),
            // so a boolean comparator like (a, b) => a > b would produce invalid Solidity.
            const comparatorEnv = new Map(ctx.currentVarTypes);
            const comparatorParamTypeForInfer = sortParamType ?? elementType;
            if (comparatorParamTypeForInfer) {
              comparatorEnv.set(
                callback.paramName,
                comparatorParamTypeForInfer
              );
              if (callback.secondParamName)
                comparatorEnv.set(
                  callback.secondParamName,
                  comparatorParamTypeForInfer
                );
            }
            const comparatorType = inferType(condExpr, comparatorEnv);
            const comparatorKind = comparatorType?.kind as string | undefined;
            if (comparatorKind === "bool") {
              throw new Error(
                "Array .sort() comparator must return a signed or unsigned integer (e.g. (a, b) => a - b), not a boolean expression like (a, b) => a > b."
              );
            }
            if (
              comparatorKind &&
              comparatorKind !== "uint256" &&
              comparatorKind !== "int256"
            ) {
              throw new Error(
                `Array .sort() comparator must return an int256 or uint256. Got ${comparatorKind} instead.`
              );
            }
            const helper = generateSortHelper(
              receiverExpr,
              elementType,
              callback.paramName,
              callback.secondParamName,
              condExpr
            );
            ctx.generatedArrayFunctions.push(helper);
            return mkHelperCall(helper.name);
          }

          // forEach: desugar to a for loop (via a helper that returns nothing)
          if (methodName === "forEach") {
            const helperName = `_forEach_${ctx.arrayMethodCounter++}`;
            const elemType = elementType ?? UINT256_TYPE;
            const forBody: Statement[] = [
              mkVarDecl(
                callback.paramName,
                elemType,
                mkElem(receiverExpr, mkId("__sk_i"))
              ),
            ];
            if (callback.bodyExpr) {
              forBody.push(mkExprStmt(callback.bodyExpr));
            } else if (callback.bodyStmts) {
              forBody.push(...callback.bodyStmts);
            }
            const body: Statement[] = [
              mkForLoop("__sk_i", receiverExpr, forBody),
            ];
            const helperMutability = inferStateMutability(
              body,
              ctx.currentVarTypes
            );
            const helper: SkittlesFunction = {
              name: helperName,
              parameters: [],
              returnType: null,
              visibility: "private",
              stateMutability: helperMutability,
              isVirtual: false,
              isOverride: false,
              body,
            };
            ctx.generatedArrayFunctions.push(helper);
            return mkHelperCall(helperName);
          }
        }
      }

      // remove(value) → _arrRemove_T(arr, value)
      if (methodName === "remove" && node.arguments.length === 1) {
        if (isNonComparable)
          throw new Error(
            `Unsupported: .remove() on ${typeSuffix}[] arrays. Element type does not support equality in Solidity. Use .findIndex() with a callback and .splice() instead.`
          );
        ctx.neededArrayHelpers.add(`remove_${typeSuffix}`);
        return {
          kind: "call" as const,
          callee: {
            kind: "identifier" as const,
            name: `_arrRemove_${typeSuffix}`,
          },
          args: [receiverExpr, parseExpression(node.arguments[0])],
        };
      }

      // reverse() → _arrReverse_T(arr)
      if (methodName === "reverse" && node.arguments.length === 0) {
        if (node.parent && !ts.isExpressionStatement(node.parent)) {
          throw new Error(
            "Array .reverse() modifies the array in place and does not return a value. Use it as a standalone statement."
          );
        }
        ctx.neededArrayHelpers.add(`reverse_${typeSuffix}`);
        return {
          kind: "call" as const,
          callee: {
            kind: "identifier" as const,
            name: `_arrReverse_${typeSuffix}`,
          },
          args: [receiverExpr],
        };
      }

      // splice(start, deleteCount) → _arrSplice_T(arr, start, deleteCount)
      if (methodName === "splice" && node.arguments.length >= 1) {
        if (node.parent && !ts.isExpressionStatement(node.parent)) {
          throw new Error(
            "Array .splice() modifies the array in place and does not return a value. Use it as a standalone statement."
          );
        }
        if (node.arguments.length > 2)
          throw new Error(
            "Array .splice() only supports deletion (up to 2 arguments). Insertion via splice(start, count, ...items) is not supported."
          );
        for (const arg of node.arguments) {
          if (
            ts.isPrefixUnaryExpression(arg) &&
            arg.operator === ts.SyntaxKind.MinusToken
          ) {
            throw new Error(
              "Array .splice() does not support negative indices. Solidity uses uint256 for array indices."
            );
          }
        }
        ctx.neededArrayHelpers.add(`splice_${typeSuffix}`);
        const startArg = parseExpression(node.arguments[0]);
        const countArg =
          node.arguments.length >= 2
            ? parseExpression(node.arguments[1])
            : mkNum("1");
        return {
          kind: "call" as const,
          callee: {
            kind: "identifier" as const,
            name: `_arrSplice_${typeSuffix}`,
          },
          args: [receiverExpr, startArg, countArg],
        };
      }

      if (KNOWN_ARRAY_METHODS.has(methodName)) {
        throw new Error(
          `Array .${methodName}() called with unsupported arguments. Check the method signature in the Skittles documentation.`
        );
      }
    }

    // String method calls: str.charAt(i) → _charAt(str, i), etc.
    if (ts.isPropertyAccessExpression(node.expression)) {
      const methodName = node.expression.name.text;
      const methodDef = STRING_METHODS[methodName];
      if (methodDef) {
        const receiver = parseExpression(node.expression.expression);
        if (isStringExpr(receiver)) {
          const argCount = node.arguments.length;
          if (argCount > methodDef.maxArgs) {
            const overloadHint =
              methodDef.minArgs < methodDef.maxArgs
                ? `Skittles supports: str.${methodName}(${describeExpectedArgs(methodName, methodDef.minArgs)}) or str.${methodName}(${describeExpectedArgs(methodName, methodDef.maxArgs)}).`
                : `Skittles only supports: str.${methodName}(${describeExpectedArgs(methodName, methodDef.maxArgs)}).`;
            throw new Error(
              `String method .${methodName}() accepts at most ${methodDef.maxArgs} argument(s), but ${argCount} were provided. ` +
                overloadHint
            );
          }
          if (argCount < methodDef.minArgs) {
            throw new Error(
              `String method .${methodName}() requires at least ${methodDef.minArgs} argument(s), but ${argCount} were provided.`
            );
          }
          const args = node.arguments.map(parseExpression);
          // charAt() without index → charAt(0)
          if (methodName === "charAt" && args.length === 0) {
            args.push({ kind: "number-literal" as const, value: "0" });
          }
          // substring(start) without end → substring(start, bytes(str).length)
          if (methodName === "substring" && args.length === 1) {
            args.push({
              kind: "property-access" as const,
              object: {
                kind: "call" as const,
                callee: { kind: "identifier" as const, name: "bytes" },
                args: [receiver],
              },
              property: "length",
            });
          }
          return {
            kind: "call" as const,
            callee: { kind: "identifier" as const, name: methodDef.helper },
            args: [receiver, ...args],
          };
        }
      }
    }

    const callExpr: {
      kind: "call";
      callee: Expression;
      args: Expression[];
      typeArgs?: SkittlesType[];
    } = {
      kind: "call",
      callee: parseExpression(node.expression),
      args: node.arguments.map(parseExpression),
    };

    if (node.typeArguments && node.typeArguments.length > 0) {
      const firstTypeArg = node.typeArguments[0];
      if (ts.isTupleTypeNode(firstTypeArg)) {
        callExpr.typeArgs = firstTypeArg.elements.map((elem) => {
          if (ts.isNamedTupleMember(elem)) {
            return parseType(elem.type);
          }
          return parseType(elem);
        });
      } else {
        callExpr.typeArgs = node.typeArguments.map((ta) => parseType(ta));
      }
    }

    return callExpr;
  }

  if (ts.isNewExpression(node)) {
    const callee = getNodeName(node.expression);
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
    const hasSpread = node.elements.some(ts.isSpreadElement);

    if (hasSpread) {
      // Spread array expression: [...a, ...b] → _arrSpread_T(a, b)
      const nonSpread = node.elements.find(
        (e: ts.Expression) => !ts.isSpreadElement(e)
      );
      if (nonSpread) {
        throw new Error(
          "Array spread does not support mixing spread and non-spread elements. Use [...a, ...b] or build the array manually."
        );
      }

      const spreadExprs = node.elements.map((e: ts.Expression) => {
        if (!ts.isSpreadElement(e))
          throw new Error("Unexpected non-spread element");
        return e.expression;
      });

      // Resolve element type from the first spread operand
      let elementType: SkittlesType | undefined;
      for (const spreadExpr of spreadExprs) {
        elementType = resolveSpreadElementType(spreadExpr);
        if (elementType) break;
      }
      if (!elementType) {
        throw new Error(
          "Could not resolve element type for array spread. " +
            "Ensure spread operands are arrays with statically known element types."
        );
      }
      const typeSuffix = getArrayHelperSuffix(elementType);

      ctx.neededArrayHelpers.add(`spread_${typeSuffix}`);

      // Parse each spread operand, wrapping storage arrays in a slice call
      const parsedOperands: Expression[] = spreadExprs.map(
        (e: ts.Expression) => {
          if (
            ts.isPropertyAccessExpression(e) &&
            e.expression.kind === ts.SyntaxKind.ThisKeyword
          ) {
            const name = e.name.text;
            const type = ctx.currentVarTypes.get(name);
            if (type?.kind === SkittlesTypeKind.Array) {
              // Storage array: wrap in slice to copy to memory
              ctx.neededArrayHelpers.add(`slice_${typeSuffix}`);
              const parsed = parseExpression(e);
              return {
                kind: "call" as const,
                callee: {
                  kind: "identifier" as const,
                  name: `_arrSlice_${typeSuffix}`,
                },
                args: [
                  parsed,
                  { kind: "number-literal" as const, value: "0" },
                  {
                    kind: "property-access" as const,
                    object: parsed,
                    property: "length",
                  },
                ],
              };
            }
          }
          return parseExpression(e);
        }
      );

      // Chain calls for 2+ arrays: _arrSpread_T(_arrSpread_T(a, b), c)
      let result: Expression = parsedOperands[0];
      for (let i = 1; i < parsedOperands.length; i++) {
        result = {
          kind: "call" as const,
          callee: {
            kind: "identifier" as const,
            name: `_arrSpread_${typeSuffix}`,
          },
          args: [result, parsedOperands[i]],
        };
      }
      return result;
    }

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
        properties.push({
          name: prop.name.text,
          value: parseExpression(prop.initializer),
        });
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        properties.push({
          name: prop.name.text,
          value: { kind: "identifier", name: prop.name.text },
        });
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
    // Build a combined type map with local precedence for plain identifiers.
    // Note: ctx.currentVarTypes is initially seeded with state-var entries, so we
    // filter out any entries that are just unchanged copies of ctx.stateVarTypes
    // to avoid overwriting shadowing params back to the state-var type.
    const localsOnlyVarTypes = new Map<string, SkittlesType>();
    for (const [name, type] of ctx.currentVarTypes) {
      const stateType = ctx.stateVarTypes.get(name);
      // Include if there is no corresponding state var, or if this entry
      // represents a true local/shadowing type distinct from the seeded one.
      if (!stateType || stateType !== type) {
        localsOnlyVarTypes.set(name, type);
      }
    }
    const combinedTypes = new Map<string, SkittlesType>([
      ...ctx.stateVarTypes,
      ...ctx.currentParamTypes,
      ...localsOnlyVarTypes,
    ]);
    for (const span of node.templateSpans) {
      const expr = parseExpression(span.expression);
      // Wrap uint256 expressions with __sk_toString() for Solidity compatibility.
      // isStringExpr catches known string identifiers and string.concat calls;
      // inferType provides deeper type inference for other expressions.
      // Only wrap when the type is explicitly uint256. For `this.<prop>`, resolve
      // against state-var types so that local/param shadowing doesn't affect the result.
      // Unknown types (e.g. function calls returning string) and int256 are left
      // unwrapped since the __sk_toString helper only accepts uint256.
      const isString = isStringExpr(expr);
      let type: SkittlesType | undefined;
      if (!isString) {
        if (
          expr.kind === "property-access" &&
          expr.object.kind === "identifier" &&
          expr.object.name === "this"
        ) {
          // For this.<prop>, always resolve against original state-var types
          type = ctx.stateVarTypes.get(expr.property);
        } else {
          type = inferType(expr, combinedTypes);
        }
      }
      const isUint256 =
        type !== undefined && type.kind === SkittlesTypeKind.Uint256;
      if (isUint256) {
        parts.push({
          kind: "call",
          callee: { kind: "identifier", name: "__sk_toString" },
          args: [expr],
        });
      } else {
        parts.push(expr);
      }
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

function isArrayLikeReceiver(node: ts.Expression): boolean {
  if (
    ts.isPropertyAccessExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ThisKeyword
  ) {
    const name = node.name.text;
    const type = ctx.currentVarTypes.get(name);
    return type?.kind === SkittlesTypeKind.Array;
  }
  return false;
}

function resolveArrayElementType(
  node: ts.Expression
): SkittlesType | undefined {
  if (
    ts.isPropertyAccessExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ThisKeyword
  ) {
    const name = node.name.text;
    const type = ctx.currentVarTypes.get(name);
    if (type?.kind === SkittlesTypeKind.Array) {
      return type.valueType;
    }
  }
  return undefined;
}

function resolveSpreadElementType(
  node: ts.Expression
): SkittlesType | undefined {
  // this.arr case (storage array)
  if (
    ts.isPropertyAccessExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ThisKeyword
  ) {
    const name = node.name.text;
    const type = ctx.currentVarTypes.get(name);
    if (type?.kind === SkittlesTypeKind.Array) return type.valueType;
  }
  // function parameter case
  if (ts.isIdentifier(node)) {
    const type = ctx.currentParamTypes.get(node.text);
    if (type?.kind === SkittlesTypeKind.Array) return type.valueType;
  }
  return undefined;
}

function parseArrowCallback(
  node: ts.Expression,
  paramTypes?: { first?: SkittlesType; second?: SkittlesType }
): {
  paramName: string;
  secondParamName?: string;
  bodyExpr?: Expression;
  bodyStmts?: Statement[];
} | null {
  if (!ts.isArrowFunction(node)) return null;
  if (node.parameters.length < 1) return null;
  const paramName = ts.isIdentifier(node.parameters[0].name)
    ? node.parameters[0].name.text
    : "_item";
  const secondParamName =
    node.parameters.length >= 2 && ts.isIdentifier(node.parameters[1].name)
      ? node.parameters[1].name.text
      : undefined;

  validateReservedName("Callback parameter name", paramName);
  if (secondParamName) {
    validateReservedName("Callback parameter name", secondParamName);
  }

  // Set up callback-local type/string-tracking scopes seeded with outer scopes and param types
  const outerVarTypes = ctx.currentVarTypes;
  const outerStringNames = ctx.currentStringNames;
  const callbackVarTypes = new Map(outerVarTypes);
  const callbackStringNames = new Set(outerStringNames);
  // Ensure callback parameters correctly shadow any outer string variables with the same name
  callbackStringNames.delete(paramName);
  if (secondParamName) {
    callbackStringNames.delete(secondParamName);
  }
  if (paramTypes?.first) {
    callbackVarTypes.set(paramName, paramTypes.first);
    if (paramTypes.first.kind === SkittlesTypeKind.String) {
      callbackStringNames.add(paramName);
    }
  }
  if (paramTypes?.second && secondParamName) {
    callbackVarTypes.set(secondParamName, paramTypes.second);
    if (paramTypes.second.kind === SkittlesTypeKind.String) {
      callbackStringNames.add(secondParamName);
    }
  }
  ctx.currentVarTypes = callbackVarTypes;
  ctx.currentStringNames = callbackStringNames;

  try {
    if (ts.isBlock(node.body)) {
      const stmts = node.body.statements;
      if (
        stmts.length === 1 &&
        ts.isReturnStatement(stmts[0]) &&
        stmts[0].expression
      ) {
        return {
          paramName,
          secondParamName,
          bodyExpr: parseExpression(stmts[0].expression),
        };
      }
      const parsedStmts: Statement[] = [];
      for (const s of stmts) {
        parsedStmts.push(
          ...parseStatements(s, callbackVarTypes, ctx.currentEventNames)
        );
      }
      return { paramName, secondParamName, bodyStmts: parsedStmts };
    }
    return {
      paramName,
      secondParamName,
      bodyExpr: parseExpression(node.body as ts.Expression),
    };
  } finally {
    ctx.currentVarTypes = outerVarTypes;
    ctx.currentStringNames = outerStringNames;
  }
}

function generateFilterHelper(
  arrayExpr: Expression,
  elementType: SkittlesType | undefined,
  paramName: string,
  condExpr: Expression
): SkittlesFunction {
  const helperName = `_filter_${ctx.arrayMethodCounter++}`;
  const elemType = elementType ?? UINT256_TYPE;
  const arrType: SkittlesType = {
    kind: SkittlesTypeKind.Array,
    valueType: elemType,
  };
  const elemTypeName = typeToSolidityName(elemType);
  const body: Statement[] = [
    mkVarDecl("__sk_count", UINT256_TYPE, mkNum("0")),
    mkForLoop("__sk_i", arrayExpr, [
      mkVarDecl(paramName, elemType, mkElem(arrayExpr, mkId("__sk_i"))),
      mkIf(condExpr, [mkExprStmt(mkIncr("__sk_count"))]),
    ]),
    mkVarDecl("__sk_result", arrType, {
      kind: "new",
      callee: `${elemTypeName}[]`,
      args: [mkId("__sk_count")],
    }),
    mkVarDecl("__sk_j", UINT256_TYPE, mkNum("0")),
    mkForLoop("__sk_i2", arrayExpr, [
      mkVarDecl(paramName, elemType, mkElem(arrayExpr, mkId("__sk_i2"))),
      mkIf(condExpr, [
        mkExprStmt(
          mkAssign(
            mkElem(mkId("__sk_result"), mkId("__sk_j")),
            mkElem(arrayExpr, mkId("__sk_i2"))
          )
        ),
        mkExprStmt(mkIncr("__sk_j")),
      ]),
    ]),
    mkReturn(mkId("__sk_result")),
  ];
  return {
    name: helperName,
    parameters: [],
    returnType: arrType,
    visibility: "private",
    stateMutability: inferStateMutability(body, ctx.currentVarTypes),
    isVirtual: false,
    isOverride: false,
    body,
  };
}

function generateMapHelper(
  arrayExpr: Expression,
  elementType: SkittlesType | undefined,
  paramName: string,
  transformExpr: Expression,
  resultElementType: SkittlesType | undefined
): SkittlesFunction {
  const helperName = `_map_${ctx.arrayMethodCounter++}`;
  const elemType = elementType ?? UINT256_TYPE;
  const resultElemType = resultElementType ?? UINT256_TYPE;
  const arrType: SkittlesType = {
    kind: SkittlesTypeKind.Array,
    valueType: resultElemType,
  };
  const resultTypeName = typeToSolidityName(resultElemType);
  const body: Statement[] = [
    mkVarDecl("__sk_result", arrType, {
      kind: "new",
      callee: `${resultTypeName}[]`,
      args: [mkProp(arrayExpr, "length")],
    }),
    mkForLoop("__sk_i", arrayExpr, [
      mkVarDecl(paramName, elemType, mkElem(arrayExpr, mkId("__sk_i"))),
      mkExprStmt(
        mkAssign(mkElem(mkId("__sk_result"), mkId("__sk_i")), transformExpr)
      ),
    ]),
    mkReturn(mkId("__sk_result")),
  ];
  return {
    name: helperName,
    parameters: [],
    returnType: arrType,
    visibility: "private",
    stateMutability: inferStateMutability(body, ctx.currentVarTypes),
    isVirtual: false,
    isOverride: false,
    body,
  };
}

function generateSomeEveryHelper(
  method: "some" | "every",
  arrayExpr: Expression,
  elementType: SkittlesType | undefined,
  paramName: string,
  condExpr: Expression
): SkittlesFunction {
  const helperName = `_${method}_${ctx.arrayMethodCounter++}`;
  const elemType = elementType ?? UINT256_TYPE;
  const isSome = method === "some";
  const body: Statement[] = [
    mkForLoop("__sk_i", arrayExpr, [
      mkVarDecl(paramName, elemType, mkElem(arrayExpr, mkId("__sk_i"))),
      mkIf(
        isSome
          ? condExpr
          : { kind: "unary", operator: "!", operand: condExpr, prefix: true },
        [
          mkReturn(
            isSome
              ? { kind: "boolean-literal", value: true }
              : { kind: "boolean-literal", value: false }
          ),
        ]
      ),
    ]),
    mkReturn(
      isSome
        ? { kind: "boolean-literal", value: false }
        : { kind: "boolean-literal", value: true }
    ),
  ];
  return {
    name: helperName,
    parameters: [],
    returnType: BOOL_TYPE,
    visibility: "private",
    stateMutability: inferStateMutability(body, ctx.currentVarTypes),
    isVirtual: false,
    isOverride: false,
    body,
  };
}

function generateFindHelper(
  arrayExpr: Expression,
  elementType: SkittlesType | undefined,
  paramName: string,
  condExpr: Expression
): SkittlesFunction {
  const helperName = `_find_${ctx.arrayMethodCounter++}`;
  const elemType = elementType ?? UINT256_TYPE;
  const body: Statement[] = [
    mkForLoop("__sk_i", arrayExpr, [
      mkVarDecl(paramName, elemType, mkElem(arrayExpr, mkId("__sk_i"))),
      mkIf(condExpr, [mkReturn(mkId(paramName))]),
    ]),
    { kind: "revert", message: { kind: "string-literal", value: "not found" } },
  ];
  return {
    name: helperName,
    parameters: [],
    returnType: elemType,
    visibility: "private",
    stateMutability: inferStateMutability(body, ctx.currentVarTypes),
    isVirtual: false,
    isOverride: false,
    body,
  };
}

function generateFindIndexHelper(
  arrayExpr: Expression,
  elementType: SkittlesType | undefined,
  paramName: string,
  condExpr: Expression
): SkittlesFunction {
  const helperName = `_findIndex_${ctx.arrayMethodCounter++}`;
  const elemType = elementType ?? UINT256_TYPE;
  const body: Statement[] = [
    mkForLoop("__sk_i", arrayExpr, [
      mkVarDecl(paramName, elemType, mkElem(arrayExpr, mkId("__sk_i"))),
      mkIf(condExpr, [mkReturn(mkId("__sk_i"))]),
    ]),
    mkReturn(mkProp(mkId("type(uint256)"), "max")),
  ];
  return {
    name: helperName,
    parameters: [],
    returnType: UINT256_TYPE,
    visibility: "private",
    stateMutability: inferStateMutability(body, ctx.currentVarTypes),
    isVirtual: false,
    isOverride: false,
    body,
  };
}

function generateReduceHelper(
  arrayExpr: Expression,
  elementType: SkittlesType | undefined,
  accParamName: string,
  itemParamName: string,
  bodyExpr: Expression,
  initialValue: Expression,
  accType: SkittlesType | undefined
): SkittlesFunction {
  const helperName = `_reduce_${ctx.arrayMethodCounter++}`;
  const elemType = elementType ?? UINT256_TYPE;
  const returnType = accType ?? UINT256_TYPE;
  const body: Statement[] = [
    mkVarDecl("__sk_acc", returnType, initialValue),
    mkForLoop("__sk_i", arrayExpr, [
      mkVarDecl(accParamName, returnType, mkId("__sk_acc")),
      mkVarDecl(itemParamName, elemType, mkElem(arrayExpr, mkId("__sk_i"))),
      mkExprStmt(mkAssign(mkId("__sk_acc"), bodyExpr)),
    ]),
    mkReturn(mkId("__sk_acc")),
  ];
  return {
    name: helperName,
    parameters: [],
    returnType,
    visibility: "private",
    stateMutability: inferStateMutability(body, ctx.currentVarTypes),
    isVirtual: false,
    isOverride: false,
    body,
  };
}

function generateSortHelper(
  arrayExpr: Expression,
  elementType: SkittlesType | undefined,
  paramA: string,
  paramB: string,
  comparatorExpr: Expression
): SkittlesFunction {
  const helperName = `_sort_${ctx.arrayMethodCounter++}`;
  const elemType = elementType ?? UINT256_TYPE;
  const isAlreadySigned = elemType.kind === SkittlesTypeKind.Int256;
  const comparatorParamType = isAlreadySigned ? elemType : INT256_TYPE;
  // int256 cast helper: int256(expr) — only needed for uint256 elements
  const mkMaybeCast = (e: Expression): Expression =>
    isAlreadySigned
      ? e
      : {
          kind: "call" as const,
          callee: { kind: "identifier" as const, name: "int256" },
          args: [e],
        };
  // Insertion sort with comparator:
  //   uint256 __sk_len = arr.length;
  //   for (uint256 __sk_i = 1; __sk_i < __sk_len; __sk_i++) {
  //     <elemType> __sk_key = arr[__sk_i];
  //     uint256 __sk_j = __sk_i;
  //     while (__sk_j > 0) {
  //       <paramType> <paramA> = <cast?>(arr[__sk_j - 1]);
  //       <paramType> <paramB> = <cast?>(__sk_key);
  //       if (!(comparatorExpr > 0)) { break; }
  //       arr[__sk_j] = arr[__sk_j - 1];
  //       __sk_j--;
  //     }
  //     arr[__sk_j] = __sk_key;
  //   }
  //
  // For uint256 arrays, comparator params are cast to int256 so that
  // subtraction patterns like (a, b) => a - b work without reverting on
  // underflow. This cast is only safe and order-preserving for values
  // <= type(int256).max (i.e., < 2^255); sorting arrays that may contain
  // larger uint256 values can still revert at the cast step, regardless
  // of whether the comparator uses subtraction or comparisons.
  // For int256 arrays, params are used directly with no cast.
  const body: Statement[] = [
    mkVarDecl("__sk_len", UINT256_TYPE, mkProp(arrayExpr, "length")),
    {
      kind: "for",
      initializer: {
        kind: "variable-declaration",
        name: "__sk_i",
        type: UINT256_TYPE,
        initializer: mkNum("1"),
      },
      condition: mkBin(mkId("__sk_i"), "<", mkId("__sk_len")),
      incrementor: mkIncr("__sk_i"),
      body: [
        mkVarDecl("__sk_key", elemType, mkElem(arrayExpr, mkId("__sk_i"))),
        mkVarDecl("__sk_j", UINT256_TYPE, mkId("__sk_i")),
        {
          kind: "while" as const,
          condition: mkBin(mkId("__sk_j"), ">", mkNum("0")),
          body: [
            mkVarDecl(
              paramA,
              comparatorParamType,
              mkMaybeCast(
                mkElem(arrayExpr, mkBin(mkId("__sk_j"), "-", mkNum("1")))
              )
            ),
            mkVarDecl(
              paramB,
              comparatorParamType,
              mkMaybeCast(mkId("__sk_key"))
            ),
            mkIf(
              {
                kind: "unary",
                operator: "!",
                operand: mkBin(comparatorExpr, ">", mkNum("0")),
                prefix: true,
              },
              [{ kind: "break" as const }]
            ),
            mkExprStmt(
              mkAssign(
                mkElem(arrayExpr, mkId("__sk_j")),
                mkElem(arrayExpr, mkBin(mkId("__sk_j"), "-", mkNum("1")))
              )
            ),
            mkExprStmt(mkDecr("__sk_j")),
          ],
        },
        mkExprStmt(
          mkAssign(mkElem(arrayExpr, mkId("__sk_j")), mkId("__sk_key"))
        ),
      ],
    },
  ];
  return {
    name: helperName,
    parameters: [],
    returnType: null,
    visibility: "private",
    stateMutability: inferStateMutability(body, ctx.currentVarTypes),
    isVirtual: false,
    isOverride: false,
    body,
  };
}

export function isMappingLikeReceiver(node: ts.Expression): boolean {
  if (
    ts.isPropertyAccessExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ThisKeyword
  ) {
    const name = node.name.text;
    const type = ctx.currentVarTypes.get(name);
    return type?.kind === SkittlesTypeKind.Mapping;
  }
  if (ts.isElementAccessExpression(node)) {
    return isMappingLikeReceiver(node.expression);
  }
  return false;
}

/**
 * Resolve the mapping value type for a mapping-like receiver expression.
 * For `this.balances` where balances is `Map<address, number>`, returns the `number` type.
 * For `this.allowances[owner]` where allowances is `Map<address, Map<address, number>>`,
 * returns the inner `number` type.
 */
function resolveMappingValueType(
  node: ts.Expression
): SkittlesType | undefined {
  if (
    ts.isPropertyAccessExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ThisKeyword
  ) {
    const name = node.name.text;
    const type = ctx.currentVarTypes.get(name);
    if (type?.kind === SkittlesTypeKind.Mapping) {
      return type.valueType;
    }
    return undefined;
  }
  if (ts.isElementAccessExpression(node)) {
    const parentValueType = resolveMappingValueType(node.expression);
    if (parentValueType?.kind === SkittlesTypeKind.Mapping) {
      return parentValueType.valueType;
    }
    return undefined;
  }
  return undefined;
}
