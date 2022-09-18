import {
  BinaryExpression,
  ConditionalExpression,
  ElementAccessExpression,
  Expression,
  Identifier,
  isBinaryExpression,
  isConditionalExpression,
  isElementAccessExpression,
  isIdentifier,
  isLiteralExpression,
  isNewExpression,
  isParenthesizedExpression,
  isPrefixUnaryExpression,
  isPropertyAccessExpression,
  LiteralExpression,
  NewExpression,
  PrefixUnaryExpression,
  PropertyAccessExpression,
  SyntaxKind,
} from "typescript";
import { getNodeName, isFalseKeyword, isTrueKeyword } from "../helpers/ast-helper";
import { SkittlesConstants, SkittlesInterfaces } from "../types/skittles-contract";
import { SkittlesTypeKind } from "../types/skittles-type";
import { SkittlesExpression, SkittlesExpressionType } from "../types/skittles-expression";
import getSkittlesOperator from "./get-skittles-operator";
import getSkittlesType from "./get-skittles-type";

const getIdentifierExpression = (
  expression: Identifier,
  constants: SkittlesConstants
): SkittlesExpression => {
  // Handling if it's a global constant
  const variable = expression.escapedText;
  if (variable && constants[variable]) {
    const constant = constants[variable];
    if (constant) return constant;
  }

  // Handling if it's some local variable
  return {
    expressionType: SkittlesExpressionType.Variable,
    value: expression.escapedText,
  };
};

const getLiteralExpression = (
  expression: LiteralExpression,
  interfaces: SkittlesInterfaces
): SkittlesExpression => {
  const value = expression.text;
  return {
    expressionType: SkittlesExpressionType.Value,
    type: getSkittlesType(expression, interfaces, value),
    value,
  };
};

const getPropertyAccessExpression = (
  expression: PropertyAccessExpression,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesExpression => {
  if (expression.expression.kind === SyntaxKind.PropertyAccessExpression) {
    const property = getNodeName(expression);
    switch (property) {
      case "length":
        return {
          expressionType: SkittlesExpressionType.Length,
          value: getSkittlesExpression(expression.expression, interfaces, constants),
        };
      default:
        throw new Error(`Unknown property access property: ${property}`);
    }
  }
  if (expression.expression.kind === SyntaxKind.ThisKeyword) {
    return {
      expressionType: SkittlesExpressionType.Storage,
      variable: getNodeName(expression),
    };
  }
  if (expression.expression.kind === SyntaxKind.Identifier) {
    const environment = (expression.expression as any).escapedText;
    if (!environment) throw new Error("Could not get environment");
    if (["block", "chain", "msg", "tx"].includes(environment)) {
      return {
        expressionType: SkittlesExpressionType.EvmDialect,
        environment: environment,
        variable: getNodeName(expression),
      };
    }
    if (environment === "Number") {
      const element = getNodeName(expression.name);
      if (element === "MAX_SAFE_INTEGER" || element === "MAX_VALUE") {
        return {
          expressionType: SkittlesExpressionType.Value,
          type: {
            kind: SkittlesTypeKind.Number,
          },
          value: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        };
      }
      throw new Error(`Could not get value for ${element}`);
    }
    throw new Error(`Unknown environment: ${environment}`);
  }
  throw new Error(`Property access expression not supported ${expression.kind}`);
};

const getBinaryExpression = (
  expression: BinaryExpression,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesExpression => {
  return {
    expressionType: SkittlesExpressionType.Binary,
    left: getSkittlesExpression(expression.left, interfaces, constants),
    right: getSkittlesExpression(expression.right, interfaces, constants),
    operator: getSkittlesOperator(expression.operatorToken.kind),
  };
};

const getElementAccessExpression = (
  expression: ElementAccessExpression,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesExpression => {
  let e: Expression = expression;
  const items: SkittlesExpression[] = [];
  while (isElementAccessExpression(e)) {
    items.unshift(getSkittlesExpression(e.argumentExpression, interfaces, constants));
    e = e.expression;
  }

  return {
    expressionType: SkittlesExpressionType.Mapping,
    variable: getNodeName(e),
    items,
  };
};

const getPrefixUnaryExpression = (
  expression: PrefixUnaryExpression,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesExpression => {
  return {
    expressionType: SkittlesExpressionType.Not,
    value: getSkittlesExpression(expression.operand, interfaces, constants),
  };
};

const getBooleanExpression = (item: boolean): SkittlesExpression => {
  return {
    expressionType: SkittlesExpressionType.Value,
    type: { kind: SkittlesTypeKind.Void },
    value: item ? "true" : "false",
  };
};

const getThisExpression = (): SkittlesExpression => {
  return {
    expressionType: SkittlesExpressionType.This,
  };
};

const getNewExpression = (
  expression: NewExpression,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesExpression => {
  return {
    expressionType: SkittlesExpressionType.Deploy,
    contract: getNodeName(expression.expression),
    parameters:
      expression.arguments?.map((arg) => getSkittlesExpression(arg, interfaces, constants)) || [],
  };
};

const getConditionalExpression = (
  expression: ConditionalExpression,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesExpression => {
  return {
    expressionType: SkittlesExpressionType.Conditional,
    condition: getSkittlesExpression(expression.condition, interfaces, constants),
    trueValue: getSkittlesExpression(expression.whenTrue, interfaces, constants),
    falseValue: getSkittlesExpression(expression.whenFalse, interfaces, constants),
  };
};

const getSkittlesExpression = (
  expression: Expression,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesExpression => {
  if (isIdentifier(expression)) {
    return getIdentifierExpression(expression, constants);
  }
  if (isLiteralExpression(expression)) {
    return getLiteralExpression(expression, interfaces);
  }
  if (isPropertyAccessExpression(expression)) {
    return getPropertyAccessExpression(expression, interfaces, constants);
  }
  if (isBinaryExpression(expression)) {
    return getBinaryExpression(expression, interfaces, constants);
  }
  if (isElementAccessExpression(expression)) {
    return getElementAccessExpression(expression, interfaces, constants);
  }
  if (isParenthesizedExpression(expression)) {
    return getSkittlesExpression(expression.expression, interfaces, constants);
  }
  if (isPrefixUnaryExpression(expression)) {
    return getPrefixUnaryExpression(expression, interfaces, constants);
  }
  if (isTrueKeyword(expression)) {
    return getBooleanExpression(true);
  }
  if (isFalseKeyword(expression)) {
    return getBooleanExpression(false);
  }
  if (expression.kind === SyntaxKind.ThisKeyword) {
    return getThisExpression();
  }
  if (isNewExpression(expression)) {
    return getNewExpression(expression, interfaces, constants);
  }
  if (isConditionalExpression(expression)) {
    return getConditionalExpression(expression, interfaces, constants);
  }

  throw new Error(`Unknown expression type: ${expression.kind}`);
};

export default getSkittlesExpression;
