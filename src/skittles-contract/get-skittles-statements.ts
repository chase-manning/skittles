import {
  BinaryExpression,
  Expression,
  ExpressionStatement,
  IfStatement,
  isBinaryExpression,
  isBlock,
  isCallExpression,
  isElementAccessExpression,
  isExpressionStatement,
  isIdentifier,
  isIfStatement,
  isLiteralExpression,
  isNewExpression,
  isObjectLiteralExpression,
  isPrefixUnaryExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isReturnStatement,
  isThrowStatement,
  isVariableStatement,
  Node,
  Statement,
  SyntaxKind,
  ThrowStatement,
  VariableStatement,
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
  SkittlesType,
  SkittlesTypeKind,
} from "../types/skittles-contract";
import {
  SkittlesStatement,
  SkittlesStatementType,
} from "../types/skittles-statement";
import getSkittlesExpression from "./get-skittles-expression";
import getSkittlesType from "./get-skittles-type";

const isNotIgnored = (statement: SkittlesStatement): boolean => {
  return statement.statementType !== SkittlesStatementType.Ignore;
};

const getSkittlesStatements = (
  block: Statement | undefined,
  returnType: SkittlesType,
  interfaces: SkittlesInterfaces
): SkittlesStatement[] => {
  if (!block) return [];
  if (isBlock(block)) {
    const { statements } = block;
    return statements
      .map((statement: Node) =>
        getSkittlesStatement(statement, returnType, interfaces)
      )
      .filter(isNotIgnored);
  }
  return [getSkittlesStatement(block, returnType, interfaces)].filter(
    isNotIgnored
  );
};

const getReturnValue = (
  expression: Expression,
  returnType: SkittlesType,
  interfaces: SkittlesInterfaces
): SkittlesExpression => {
  if (isBinaryExpression(expression)) {
    return getSkittlesExpression(expression, interfaces);
  }
  if (isPropertyAccessExpression(expression)) {
    return getSkittlesExpression(expression, interfaces);
  }
  if (isElementAccessExpression(expression)) {
    return getSkittlesExpression(expression, interfaces);
  }
  if (isTrueKeyword(expression)) {
    return {
      expressionType: SkittlesExpressionType.Value,
      type: { kind: SkittlesTypeKind.Boolean },
      value: "true",
    };
  }
  if (isFalseKeyword(expression)) {
    return {
      expressionType: SkittlesExpressionType.Value,
      type: { kind: SkittlesTypeKind.Boolean },
      value: "false",
    };
  }
  if (isPrefixUnaryExpression(expression)) {
    return {
      expressionType: SkittlesExpressionType.Not,
      value: getSkittlesExpression(expression.operand, interfaces),
    };
  }
  if (isLiteralExpression(expression)) {
    return {
      expressionType: SkittlesExpressionType.Value,
      type: getSkittlesType(expression, interfaces),
      value: getNodeName(expression),
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
      expressionType: SkittlesExpressionType.Interface,
      interface: returnType.interface,
      values,
    };
  }
  if (isIdentifier(expression)) {
    return getSkittlesExpression(expression, interfaces);
  }
  throw new Error(`Unknown return expression type: ${expression.kind}`);
};

const getReturnStatement = (
  expression: Expression,
  returnType: SkittlesType,
  interfaces: SkittlesInterfaces
): SkittlesStatement => {
  return {
    statementType: SkittlesStatementType.Return,
    type: returnType,
    value: getReturnValue(expression, returnType, interfaces),
  };
};

const getAssignmentValue = (
  expression: BinaryExpression,
  interfaces: SkittlesInterfaces
): SkittlesExpression => {
  if (isEquals(expression)) {
    return getSkittlesExpression(expression.right, interfaces);
  }
  if (isPlusEquals(expression)) {
    return {
      expressionType: SkittlesExpressionType.Binary,
      operator: SkittlesOperator.Plus,
      left: getSkittlesExpression(expression.left, interfaces),
      right: getSkittlesExpression(expression.right, interfaces),
    };
  }
  if (isMinusEquals(expression)) {
    return {
      expressionType: SkittlesExpressionType.Binary,
      operator: SkittlesOperator.Minus,
      left: getSkittlesExpression(expression.left, interfaces),
      right: getSkittlesExpression(expression.right, interfaces),
    };
  }
  throw new Error(
    `Unknown binary expression: ${expression.operatorToken.kind}`
  );
};

const getExpressionStatement = (
  statement: ExpressionStatement,
  interfaces: SkittlesInterfaces
): SkittlesStatement => {
  const { expression } = statement;
  if (isBinaryExpression(expression)) {
    if (isPropertyAccessExpression(expression.left)) {
      return {
        statementType: SkittlesStatementType.StorageUpdate,
        variable: getNodeName(expression.left),
        value: getAssignmentValue(expression, interfaces),
      };
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
      return {
        statementType: SkittlesStatementType.MappingUpdate,
        variable: getNodeName(currentExpression),
        items,
        value: getAssignmentValue(expression, interfaces),
      };
    }
    if (isIdentifier(expression.left)) {
      return {
        statementType: SkittlesStatementType.VariableUpdate,
        variable: getNodeName(expression.left),
        value: getAssignmentValue(expression, interfaces),
      };
    }
    throw new Error(`Unknown binary expression type: ${expression.kind}`);
  }
  if (isCallExpression(expression)) {
    const callExpression = expression.expression;
    if (isPropertyAccessExpression(callExpression)) {
      return {
        statementType: SkittlesStatementType.Call,
        target: getNodeName(callExpression),
        element: getSkittlesExpression(callExpression.expression, interfaces),
        parameters: expression.arguments.map((e) =>
          getSkittlesExpression(e, interfaces)
        ),
      };
    }
    if (callExpression.kind === SyntaxKind.SuperKeyword) {
      return {
        statementType: SkittlesStatementType.Ignore,
      };
    }
    throw new Error(`Unknown call expression type: ${callExpression.kind}`);
  }
  throw new Error("Not implemented expression statement handling");
};

const getIfStatement = (
  statement: IfStatement,
  interfaces: SkittlesInterfaces
): SkittlesStatement => {
  const { expression, thenStatement, elseStatement } = statement;
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
};

const getThrowStatement = (
  statement: ThrowStatement,
  interfaces: SkittlesInterfaces
): SkittlesStatement => {
  const { expression } = statement;
  if (isNewExpression(expression)) {
    const args = expression.arguments;
    if (!args) throw new Error("Throw statement has no arguments");
    if (args.length === 0) throw new Error("Throw statement has no arguments");
    if (args.length > 1)
      throw new Error("Throw statement has too many arguments");
    return {
      statementType: SkittlesStatementType.Throw,
      error: getSkittlesExpression(args[0], interfaces),
    };
  }
  throw new Error("Not implemented throw statement handling");
};

const getVariableStatement = (
  statement: VariableStatement,
  interfaces: SkittlesInterfaces
): SkittlesStatement => {
  const { declarationList } = statement;
  if (declarationList.declarations.length !== 1)
    throw new Error("Variable statement has too many declarations");
  const { name, initializer } = declarationList.declarations[0];
  if (!initializer) throw new Error("Variable statement has no initializer");
  return {
    statementType: SkittlesStatementType.VariableDeclaration,
    variable: getNodeName(name),
    value: getSkittlesExpression(initializer, interfaces),
  };
};

const getSkittlesStatement = (
  node: Node,
  returnType: SkittlesType,
  interfaces: SkittlesInterfaces
): SkittlesStatement => {
  if (isExpressionStatement(node)) {
    return getExpressionStatement(node, interfaces);
  }
  if (isReturnStatement(node)) {
    const { expression } = node;
    if (!expression) throw new Error("Return statement has no expression");
    return getReturnStatement(expression, returnType, interfaces);
  }
  if (isIfStatement(node)) {
    return getIfStatement(node, interfaces);
  }
  if (isThrowStatement(node)) {
    return getThrowStatement(node, interfaces);
  }
  if (isExpression(node)) {
    return getReturnStatement(node as Expression, returnType, interfaces);
  }
  if (isVariableStatement(node)) {
    return getVariableStatement(node, interfaces);
  }
  throw new Error(`Unknown statement type: ${node.kind}`);
};

export default getSkittlesStatements;
