import {
  Expression,
  isBinaryExpression,
  isElementAccessExpression,
  isIdentifier,
  isLiteralExpression,
  isParenthesizedExpression,
  isPrefixUnaryExpression,
  isPropertyAccessExpression,
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

const getSkittlesExpression = (
  expression: Expression,
  interfaces: SkittlesInterfaces
): SkittlesExpression => {
  if (isIdentifier(expression)) {
    return {
      expressionType: SkittlesExpressionType.Variable,
      value: expression.escapedText,
    };
  }
  if (isLiteralExpression(expression)) {
    const value = expression.text;
    return {
      expressionType: SkittlesExpressionType.Value,
      type: getSkittlesType(expression, interfaces, value),
      value,
    };
  }
  if (isPropertyAccessExpression(expression)) {
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
  }
  if (isBinaryExpression(expression)) {
    return {
      expressionType: SkittlesExpressionType.Binary,
      left: getSkittlesExpression(expression.left, interfaces),
      right: getSkittlesExpression(expression.right, interfaces),
      operator: getSkittlesOperator(expression.operatorToken.kind),
    };
  }
  if (isElementAccessExpression(expression)) {
    const items: SkittlesExpression[] = [];
    while (isElementAccessExpression(expression)) {
      items.unshift(
        getSkittlesExpression(expression.argumentExpression, interfaces)
      );
      expression = expression.expression;
    }

    return {
      expressionType: SkittlesExpressionType.Mapping,
      variable: getNodeName(expression),
      items,
    };
  }
  if (isParenthesizedExpression(expression)) {
    return getSkittlesExpression(expression.expression, interfaces);
  }
  if (isPrefixUnaryExpression(expression)) {
    return {
      expressionType: SkittlesExpressionType.Not,
      value: getSkittlesExpression(expression.operand, interfaces),
    };
  }
  if (isTrueKeyword(expression)) {
    return {
      expressionType: SkittlesExpressionType.Value,
      type: { kind: SkittlesTypeKind.Void },
      value: "true",
    };
  }
  if (isFalseKeyword(expression)) {
    return {
      expressionType: SkittlesExpressionType.Value,
      type: { kind: SkittlesTypeKind.Void },
      value: "false",
    };
  }
  throw new Error(`Unknown expression type: ${expression.kind}`);
};

export default getSkittlesExpression;
