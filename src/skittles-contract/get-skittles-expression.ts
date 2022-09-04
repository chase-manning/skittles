import {
  BinaryExpression,
  ElementAccessExpression,
  Expression,
  Identifier,
  isBinaryExpression,
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
import {
  getNodeName,
  isFalseKeyword,
  isTrueKeyword,
} from "../helpers/ast-helper";
import {
  SkittlesInterfaces,
  SkittlesTypeKind,
} from "../types/skittles-contract";
import {
  SkittlesExpression,
  SkittlesExpressionType,
} from "../types/skittles-expression";
import getSkittlesOperator from "./get-skittles-operator";
import getSkittlesType from "./get-skittles-type";

const getIdentifierExpression = (
  expression: Identifier
): SkittlesExpression => {
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
  interfaces: SkittlesInterfaces
): SkittlesExpression => {
  if (expression.expression.kind === SyntaxKind.PropertyAccessExpression) {
    const property = getNodeName(expression);
    switch (property) {
      case "length":
        return {
          expressionType: SkittlesExpressionType.Length,
          value: getSkittlesExpression(expression.expression, interfaces),
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
          value:
            "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        };
      }
      throw new Error(`Could not get value for ${element}`);
    }
    throw new Error(`Unknown environment: ${environment}`);
  }
  throw new Error(
    `Property access expression not supported ${expression.kind}`
  );
};

const getBinaryExpression = (
  expression: BinaryExpression,
  interfaces: SkittlesInterfaces
): SkittlesExpression => {
  return {
    expressionType: SkittlesExpressionType.Binary,
    left: getSkittlesExpression(expression.left, interfaces),
    right: getSkittlesExpression(expression.right, interfaces),
    operator: getSkittlesOperator(expression.operatorToken.kind),
  };
};

const getElementAccessExpression = (
  expression: ElementAccessExpression,
  interfaces: SkittlesInterfaces
): SkittlesExpression => {
  let e: Expression = expression;
  const items: SkittlesExpression[] = [];
  while (isElementAccessExpression(e)) {
    items.unshift(getSkittlesExpression(e.argumentExpression, interfaces));
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
  interfaces: SkittlesInterfaces
): SkittlesExpression => {
  return {
    expressionType: SkittlesExpressionType.Not,
    value: getSkittlesExpression(expression.operand, interfaces),
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
  interfaces: SkittlesInterfaces
): SkittlesExpression => {
  return {
    expressionType: SkittlesExpressionType.Deploy,
    contract: getNodeName(expression.expression),
    parameters:
      expression.arguments?.map((arg) =>
        getSkittlesExpression(arg, interfaces)
      ) || [],
  };
};

const getSkittlesExpression = (
  expression: Expression,
  interfaces: SkittlesInterfaces
): SkittlesExpression => {
  if (isIdentifier(expression)) {
    return getIdentifierExpression(expression);
  }
  if (isLiteralExpression(expression)) {
    return getLiteralExpression(expression, interfaces);
  }
  if (isPropertyAccessExpression(expression)) {
    return getPropertyAccessExpression(expression, interfaces);
  }
  if (isBinaryExpression(expression)) {
    return getBinaryExpression(expression, interfaces);
  }
  if (isElementAccessExpression(expression)) {
    return getElementAccessExpression(expression, interfaces);
  }
  if (isParenthesizedExpression(expression)) {
    return getSkittlesExpression(expression.expression, interfaces);
  }
  if (isPrefixUnaryExpression(expression)) {
    return getPrefixUnaryExpression(expression, interfaces);
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
    return getNewExpression(expression, interfaces);
  }

  throw new Error(`Unknown expression type: ${expression.kind}`);
};

export default getSkittlesExpression;
