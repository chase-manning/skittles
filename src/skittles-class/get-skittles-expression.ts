import {
  BinaryExpression,
  ElementAccessExpression,
  Expression,
  Identifier,
  isBinaryExpression,
  isElementAccessExpression,
  isIdentifier,
  isLiteralExpression,
  isParenthesizedExpression,
  isPrefixUnaryExpression,
  isPropertyAccessExpression,
  LiteralExpression,
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
  SkittlesExpression,
  SkittlesExpressionType,
  SkittlesInterfaces,
  SkittlesTypeKind,
} from "../types/skittles-class";
import getSkittlesOperator from "./get-skittles-operator";
import getSkittlesType from "./get-skittles-type";

const getIdentifierYul = (expression: Identifier): SkittlesExpression => {
  return {
    expressionType: SkittlesExpressionType.Variable,
    value: expression.escapedText,
  };
};

const getLiteralYul = (
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

const getPropertyAccessExpressionYul = (
  expression: PropertyAccessExpression
): SkittlesExpression => {
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
    `Property access expression not supported ${expression.getText()}`
  );
};

const getBinaryYul = (
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

const getElementAccessYul = (
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

const getPrefixUnaryYul = (
  expression: PrefixUnaryExpression,
  interfaces: SkittlesInterfaces
): SkittlesExpression => {
  return {
    expressionType: SkittlesExpressionType.Not,
    value: getSkittlesExpression(expression.operand, interfaces),
  };
};

const getBooleanYul = (item: boolean): SkittlesExpression => {
  return {
    expressionType: SkittlesExpressionType.Value,
    type: { kind: SkittlesTypeKind.Void },
    value: item ? "true" : "false",
  };
};

const getSkittlesExpression = (
  expression: Expression,
  interfaces: SkittlesInterfaces
): SkittlesExpression => {
  if (isIdentifier(expression)) {
    return getIdentifierYul(expression);
  }
  if (isLiteralExpression(expression)) {
    return getLiteralYul(expression, interfaces);
  }
  if (isPropertyAccessExpression(expression)) {
    return getPropertyAccessExpressionYul(expression);
  }
  if (isBinaryExpression(expression)) {
    return getBinaryYul(expression, interfaces);
  }
  if (isElementAccessExpression(expression)) {
    return getElementAccessYul(expression, interfaces);
  }
  if (isParenthesizedExpression(expression)) {
    return getSkittlesExpression(expression.expression, interfaces);
  }
  if (isPrefixUnaryExpression(expression)) {
    return getPrefixUnaryYul(expression, interfaces);
  }
  if (isTrueKeyword(expression)) {
    return getBooleanYul(true);
  }
  if (isFalseKeyword(expression)) {
    return getBooleanYul(false);
  }
  throw new Error(`Unknown expression type: ${expression.kind}`);
};

export default getSkittlesExpression;
