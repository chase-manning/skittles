import {
  Expression,
  isBinaryExpression,
  isElementAccessExpression,
  isIdentifier,
  isLiteralExpression,
  isPropertyAccessExpression,
  SyntaxKind,
} from "typescript";
import { getNodeName } from "../helpers/ast-helper";
import {
  SkittlesExpression,
  SkittlesExpressionType,
} from "../types/skittles-class";
import getSkittlesOperator from "./get-skittles-operator";
import getSkittlesType from "./get-skittles-type";

const getSkittlesExpression = (expression: Expression): SkittlesExpression => {
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
      type: getSkittlesType(expression, value),
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
      throw new Error(`Unknown environment: ${environment}`);
    }
    throw new Error(
      `Property access expression not supported ${expression.getText()}`
    );
  }
  if (isBinaryExpression(expression)) {
    return {
      expressionType: SkittlesExpressionType.Binary,
      left: getSkittlesExpression(expression.left),
      right: getSkittlesExpression(expression.right),
      operator: getSkittlesOperator(expression.operatorToken.kind),
    };
  }
  if (isElementAccessExpression(expression)) {
    const items: SkittlesExpression[] = [];
    while (isElementAccessExpression(expression)) {
      items.unshift(getSkittlesExpression(expression.argumentExpression));
      expression = expression.expression;
    }

    return {
      expressionType: SkittlesExpressionType.Mapping,
      variable: getNodeName(expression),
      items,
    };
  }
  throw new Error(`Unknown expression type: ${expression.kind}`);
};

export default getSkittlesExpression;
