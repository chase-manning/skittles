import {
  Expression,
  isBinaryExpression,
  isBlock,
  isCallExpression,
  isElementAccessExpression,
  isExpressionStatement,
  isIfStatement,
  isLiteralExpression,
  isNewExpression,
  isPrefixUnaryExpression,
  isPropertyAccessExpression,
  isReturnStatement,
  isThrowStatement,
  Node,
  Statement,
} from "typescript";
import {
  getNodeName,
  isEquals,
  isExpression,
  isFalseKeyword,
  isMinusEquals,
  isPlusEquals,
  isTrueKeyword,
} from "../helpers/ast-helper";
import {
  SkittlesExpression,
  SkittlesExpressionType,
  SkittlesOperator,
  SkittlesStatement,
  SkittlesStatementType,
} from "../types/skittles-class";
import getSkittlesExpression from "./get-skittles-expression";
import getSkittlesType from "./get-skittles-type";

const getSkittlesStatements = (
  block: Statement | undefined,
  returnType: string
): SkittlesStatement[] => {
  if (!block) return [];
  if (isBlock(block)) {
    const { statements } = block;
    return statements.map((statement: Node) =>
      getSkittlesStatement(statement, returnType)
    );
  }
  return [getSkittlesStatement(block, returnType)];
};

const getReturnStatementExpression = (
  expression: Expression,
  returnType: string
): SkittlesStatement => {
  if (isBinaryExpression(expression)) {
    return {
      statementType: SkittlesStatementType.Return,
      type: returnType,
      value: getSkittlesExpression(expression),
    };
  }
  if (isPropertyAccessExpression(expression)) {
    return {
      statementType: SkittlesStatementType.Return,
      type: returnType,
      value: getSkittlesExpression(expression),
    };
  }
  if (isElementAccessExpression(expression)) {
    return {
      statementType: SkittlesStatementType.Return,
      type: returnType,
      value: getSkittlesExpression(expression),
    };
  }
  if (isTrueKeyword(expression)) {
    return {
      statementType: SkittlesStatementType.Return,
      type: returnType,
      value: {
        expressionType: SkittlesExpressionType.Value,
        type: "bool",
        value: "true",
      },
    };
  }
  if (isFalseKeyword(expression)) {
    return {
      statementType: SkittlesStatementType.Return,
      type: returnType,
      value: {
        expressionType: SkittlesExpressionType.Value,
        type: "bool",
        value: "false",
      },
    };
  }
  if (isPrefixUnaryExpression(expression)) {
    return {
      statementType: SkittlesStatementType.Return,
      type: returnType,
      value: {
        expressionType: SkittlesExpressionType.Not,
        value: getSkittlesExpression(expression.operand),
      },
    };
  }
  if (isLiteralExpression(expression)) {
    return {
      statementType: SkittlesStatementType.Return,
      type: returnType,
      value: {
        expressionType: SkittlesExpressionType.Value,
        type: getSkittlesType(expression),
        value: getNodeName(expression),
      },
    };
  }
  throw new Error(`Unknown return expression type: ${expression.kind}`);
};

const getSkittlesStatement = (
  node: Node,
  returnType: string
): SkittlesStatement => {
  if (isExpressionStatement(node)) {
    const { expression } = node;
    if (isBinaryExpression(expression)) {
      if (isPropertyAccessExpression(expression.left)) {
        if (isEquals(expression)) {
          return {
            statementType: SkittlesStatementType.StorageUpdate,
            variable: getNodeName(expression.left),
            value: getSkittlesExpression(expression.right),
          };
        }
        if (isPlusEquals(expression)) {
          return {
            statementType: SkittlesStatementType.StorageUpdate,
            variable: getNodeName(expression.left),
            value: {
              expressionType: SkittlesExpressionType.Binary,
              operator: SkittlesOperator.Plus,
              left: getSkittlesExpression(expression.left),
              right: getSkittlesExpression(expression.right),
            },
          };
        }
        if (isMinusEquals(expression)) {
          return {
            statementType: SkittlesStatementType.StorageUpdate,
            variable: getNodeName(expression.left),
            value: {
              expressionType: SkittlesExpressionType.Binary,
              operator: SkittlesOperator.Minus,
              left: getSkittlesExpression(expression.left),
              right: getSkittlesExpression(expression.right),
            },
          };
        }
        throw new Error(
          `Unknown binary expression: ${expression.operatorToken.kind}`
        );
      }
      if (isElementAccessExpression(expression.left)) {
        let currentExpression: Node = [...[expression.left]][0];
        const items: SkittlesExpression[] = [];
        while (isElementAccessExpression(currentExpression)) {
          items.unshift(
            getSkittlesExpression((currentExpression as any).argumentExpression)
          );
          currentExpression = (currentExpression as any).expression;
        }

        if (isEquals(expression)) {
          return {
            statementType: SkittlesStatementType.MappingUpdate,
            variable: getNodeName(currentExpression),
            items,
            value: getSkittlesExpression(expression.right),
          };
        }
        if (isPlusEquals(expression)) {
          return {
            statementType: SkittlesStatementType.MappingUpdate,
            variable: getNodeName(currentExpression),
            items,
            value: {
              expressionType: SkittlesExpressionType.Binary,
              operator: SkittlesOperator.Plus,
              left: getSkittlesExpression(expression.left),
              right: getSkittlesExpression(expression.right),
            },
          };
        }
        if (isMinusEquals(expression)) {
          return {
            statementType: SkittlesStatementType.MappingUpdate,
            variable: getNodeName(currentExpression),
            items,
            value: {
              expressionType: SkittlesExpressionType.Binary,
              operator: SkittlesOperator.Minus,
              left: getSkittlesExpression(expression.left),
              right: getSkittlesExpression(expression.right),
            },
          };
        }
        throw new Error(
          `Unknown element access expression: ${expression.operatorToken.kind}`
        );
      }
      throw new Error(`Unknown binary expression type: ${expression.kind}`);
    }
    if (isCallExpression(expression)) {
      return {
        statementType: SkittlesStatementType.Call,
        target: getNodeName(expression.expression),
        parameters: expression.arguments.map(getSkittlesExpression),
      };
    }
    throw new Error("Not implemented expression statement handling");
  }
  if (isReturnStatement(node)) {
    const { expression } = node;
    if (!expression) throw new Error("Return statement has no expression");
    return getReturnStatementExpression(expression, returnType);
  }
  if (isIfStatement(node)) {
    const { expression, thenStatement, elseStatement } = node;
    if (!thenStatement) throw new Error("If statement has no then statement");
    return {
      statementType: SkittlesStatementType.If,
      condition: getSkittlesExpression(expression),
      then: getSkittlesStatements(thenStatement, "void"),
      else: getSkittlesStatements(elseStatement, "void"),
    };
  }
  if (isThrowStatement(node)) {
    const { expression } = node;
    if (isNewExpression(expression)) {
      const args = expression.arguments;
      if (!args) throw new Error("Throw statement has no arguments");
      if (args.length === 0)
        throw new Error("Throw statement has no arguments");
      if (args.length > 1)
        throw new Error("Throw statement has too many arguments");
      return {
        statementType: SkittlesStatementType.Throw,
        error: getSkittlesExpression(args[0]),
      };
    }
    throw new Error("Not implemented throw statement handling");
  }
  if (isExpression(node)) {
    return getReturnStatementExpression(node as Expression, returnType);
  }
  console.log(JSON.stringify(node));
  throw new Error(`Unknown statement type: ${node.kind}`);
};

export default getSkittlesStatements;
