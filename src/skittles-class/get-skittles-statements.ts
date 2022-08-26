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
  isObjectLiteralExpression,
  isPrefixUnaryExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
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
  SkittlesInterfaces,
  SkittlesOperator,
  SkittlesStatement,
  SkittlesStatementType,
  SkittlesType,
  SkittlesTypeKind,
} from "../types/skittles-class";
import getSkittlesExpression from "./get-skittles-expression";
import getSkittlesType from "./get-skittles-type";

const getSkittlesStatements = (
  block: Statement | undefined,
  returnType: SkittlesType,
  interfaces: SkittlesInterfaces
): SkittlesStatement[] => {
  if (!block) return [];
  if (isBlock(block)) {
    const { statements } = block;
    return statements.map((statement: Node) =>
      getSkittlesStatement(statement, returnType, interfaces)
    );
  }
  return [getSkittlesStatement(block, returnType, interfaces)];
};

const getReturnStatementExpression = (
  expression: Expression,
  returnType: SkittlesType,
  interfaces: SkittlesInterfaces
): SkittlesStatement => {
  if (isBinaryExpression(expression)) {
    return {
      statementType: SkittlesStatementType.Return,
      type: returnType,
      value: getSkittlesExpression(expression, interfaces),
    };
  }
  if (isPropertyAccessExpression(expression)) {
    return {
      statementType: SkittlesStatementType.Return,
      type: returnType,
      value: getSkittlesExpression(expression, interfaces),
    };
  }
  if (isElementAccessExpression(expression)) {
    return {
      statementType: SkittlesStatementType.Return,
      type: returnType,
      value: getSkittlesExpression(expression, interfaces),
    };
  }
  if (isTrueKeyword(expression)) {
    return {
      statementType: SkittlesStatementType.Return,
      type: returnType,
      value: {
        expressionType: SkittlesExpressionType.Value,
        type: { kind: SkittlesTypeKind.Simple, value: "bool" },
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
        type: { kind: SkittlesTypeKind.Simple, value: "bool" },
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
        value: getSkittlesExpression(expression.operand, interfaces),
      },
    };
  }
  if (isLiteralExpression(expression)) {
    return {
      statementType: SkittlesStatementType.Return,
      type: returnType,
      value: {
        expressionType: SkittlesExpressionType.Value,
        type: getSkittlesType(expression, interfaces),
        value: getNodeName(expression),
      },
    };
  }
  if (isObjectLiteralExpression(expression)) {
    const values: Record<string, SkittlesExpression> = {};

    if (returnType.kind !== SkittlesTypeKind.Interface) {
      throw new Error("Return type is not an interface");
    }

    expression.properties.forEach((property) => {
      if (!isPropertyAssignment(property)) {
        throw new Error("Could not get return statement expression");
      }

      values[getNodeName(property.name)] = getSkittlesExpression(
        property.initializer,
        interfaces
      );
    });

    return {
      statementType: SkittlesStatementType.Return,
      type: returnType,
      value: {
        expressionType: SkittlesExpressionType.Interface,
        interface: returnType.interface,
        values,
      },
    };
  }
  throw new Error(`Unknown return expression type: ${expression.kind}`);
};

const getSkittlesStatement = (
  node: Node,
  returnType: SkittlesType,
  interfaces: SkittlesInterfaces
): SkittlesStatement => {
  if (isExpressionStatement(node)) {
    const { expression } = node;
    if (isBinaryExpression(expression)) {
      if (isPropertyAccessExpression(expression.left)) {
        if (isEquals(expression)) {
          return {
            statementType: SkittlesStatementType.StorageUpdate,
            variable: getNodeName(expression.left),
            value: getSkittlesExpression(expression.right, interfaces),
          };
        }
        if (isPlusEquals(expression)) {
          return {
            statementType: SkittlesStatementType.StorageUpdate,
            variable: getNodeName(expression.left),
            value: {
              expressionType: SkittlesExpressionType.Binary,
              operator: SkittlesOperator.Plus,
              left: getSkittlesExpression(expression.left, interfaces),
              right: getSkittlesExpression(expression.right, interfaces),
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
              left: getSkittlesExpression(expression.left, interfaces),
              right: getSkittlesExpression(expression.right, interfaces),
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
            getSkittlesExpression(
              (currentExpression as any).argumentExpression,
              interfaces
            )
          );
          currentExpression = (currentExpression as any).expression;
        }

        if (isEquals(expression)) {
          return {
            statementType: SkittlesStatementType.MappingUpdate,
            variable: getNodeName(currentExpression),
            items,
            value: getSkittlesExpression(expression.right, interfaces),
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
              left: getSkittlesExpression(expression.left, interfaces),
              right: getSkittlesExpression(expression.right, interfaces),
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
              left: getSkittlesExpression(expression.left, interfaces),
              right: getSkittlesExpression(expression.right, interfaces),
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
        parameters: expression.arguments.map((e) =>
          getSkittlesExpression(e, interfaces)
        ),
      };
    }
    throw new Error("Not implemented expression statement handling");
  }
  if (isReturnStatement(node)) {
    const { expression } = node;
    if (!expression) throw new Error("Return statement has no expression");
    return getReturnStatementExpression(expression, returnType, interfaces);
  }
  if (isIfStatement(node)) {
    const { expression, thenStatement, elseStatement } = node;
    if (!thenStatement) throw new Error("If statement has no then statement");
    return {
      statementType: SkittlesStatementType.If,
      condition: getSkittlesExpression(expression, interfaces),
      then: getSkittlesStatements(
        thenStatement,
        {
          kind: SkittlesTypeKind.Void,
        },
        interfaces
      ),
      else: getSkittlesStatements(
        elseStatement,
        {
          kind: SkittlesTypeKind.Void,
        },
        interfaces
      ),
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
        error: getSkittlesExpression(args[0], interfaces),
      };
    }
    throw new Error("Not implemented throw statement handling");
  }
  if (isExpression(node)) {
    return getReturnStatementExpression(
      node as Expression,
      returnType,
      interfaces
    );
  }
  console.log(JSON.stringify(node));
  throw new Error(`Unknown statement type: ${node.kind}`);
};

export default getSkittlesStatements;
