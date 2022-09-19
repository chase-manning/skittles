import {
  BinaryExpression,
  ConditionalExpression,
  Expression,
  ExpressionStatement,
  Identifier,
  IfStatement,
  isBinaryExpression,
  isBlock,
  isCallExpression,
  isConditionalExpression,
  isElementAccessExpression,
  isParenthesizedExpression,
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
  isShorthandPropertyAssignment,
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
  SkittlesConstants,
  SkittlesEventType,
  SkittlesInterfaces,
  SkittlesValue,
} from "../types/skittles-contract";
import { SkittlesType, SkittlesTypeKind } from "../types/skittles-type";
import {
  SkittlesExpression,
  SkittlesExpressionType,
  SkittlesOperator,
} from "../types/skittles-expression";
import { SkittlesStatement, SkittlesStatementType } from "../types/skittles-statement";
import getSkittlesExpression from "./get-skittles-expression";
import getSkittlesType from "./get-skittles-type";
import extractConditionalExpressionStatements from "./extract-conditional-expression-statements";

const isNotIgnored = (statement: SkittlesStatement): boolean => {
  return statement.statementType !== SkittlesStatementType.Ignore;
};

const getSkittlesStatements = (
  block: Statement | undefined,
  returnType: SkittlesType,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants,
  events: SkittlesEventType[]
): SkittlesStatement[] => {
  if (!block) return [];
  if (isBlock(block)) {
    const { statements } = block;
    const skittlesStatements: SkittlesStatement[] = [];
    statements.forEach((statement) => {
      const skittlesStatement = getSkittlesStatement(
        statement,
        returnType,
        interfaces,
        constants,
        events
      );
      skittlesStatements.push(...skittlesStatement);
    });
    return skittlesStatements.filter(isNotIgnored);
  }
  return [...getSkittlesStatement(block, returnType, interfaces, constants, events)].filter(
    isNotIgnored
  );
};

const getReturnValue = (
  expression: Expression,
  returnType: SkittlesType,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesExpression => {
  if (isBinaryExpression(expression)) {
    return getSkittlesExpression(expression, interfaces, constants);
  }
  if (isPropertyAccessExpression(expression)) {
    return getSkittlesExpression(expression, interfaces, constants);
  }
  if (isElementAccessExpression(expression)) {
    return getSkittlesExpression(expression, interfaces, constants);
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
      value: getSkittlesExpression(expression.operand, interfaces, constants),
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
      if (isPropertyAssignment(property)) {
        values[getNodeName(property.name)] = getSkittlesExpression(
          property.initializer,
          interfaces,
          constants
        );
      } else if (isShorthandPropertyAssignment(property)) {
        values[getNodeName(property.name)] = getSkittlesExpression(
          property.name,
          interfaces,
          constants
        );
      } else {
        throw new Error("Unknown object literal property type");
      }
    });

    return {
      expressionType: SkittlesExpressionType.Interface,
      interface: returnType.interface,
      values,
    };
  }
  if (isIdentifier(expression)) {
    return getSkittlesExpression(expression, interfaces, constants);
  }
  if (isConditionalExpression(expression)) {
    return getSkittlesExpression(expression, interfaces, constants);
  }
  throw new Error(`Unknown return expression type: ${expression.kind}`);
};

const getReturnStatement = (
  expression: Expression,
  returnType: SkittlesType,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesStatement => {
  return {
    statementType: SkittlesStatementType.Return,
    type: returnType,
    value: getReturnValue(expression, returnType, interfaces, constants),
  };
};

const getAssignmentValue = (
  expression: BinaryExpression,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesExpression => {
  if (isEquals(expression)) {
    return getSkittlesExpression(expression.right, interfaces, constants);
  }
  if (isPlusEquals(expression)) {
    return {
      expressionType: SkittlesExpressionType.Binary,
      operator: SkittlesOperator.Plus,
      left: getSkittlesExpression(expression.left, interfaces, constants),
      right: getSkittlesExpression(expression.right, interfaces, constants),
    };
  }
  if (isMinusEquals(expression)) {
    return {
      expressionType: SkittlesExpressionType.Binary,
      operator: SkittlesOperator.Minus,
      left: getSkittlesExpression(expression.left, interfaces, constants),
      right: getSkittlesExpression(expression.right, interfaces, constants),
    };
  }
  throw new Error(`Unknown binary expression: ${expression.operatorToken.kind}`);
};

const getExpressionStatement = (
  statement: ExpressionStatement,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants,
  events: SkittlesEventType[]
): SkittlesStatement => {
  const { expression } = statement;
  if (isBinaryExpression(expression)) {
    if (isPropertyAccessExpression(expression.left)) {
      return {
        statementType: SkittlesStatementType.StorageUpdate,
        variable: getNodeName(expression.left),
        value: getAssignmentValue(expression, interfaces, constants),
      };
    }
    if (isElementAccessExpression(expression.left)) {
      let currentExpression: Node = [...[expression.left]][0];
      const items: SkittlesExpression[] = [];
      while (isElementAccessExpression(currentExpression)) {
        items.unshift(
          getSkittlesExpression(
            (currentExpression as any).argumentExpression,
            interfaces,
            constants
          )
        );
        currentExpression = (currentExpression as any).expression;
      }
      return {
        statementType: SkittlesStatementType.MappingUpdate,
        variable: getNodeName(currentExpression),
        items,
        value: getAssignmentValue(expression, interfaces, constants),
      };
    }
    if (isIdentifier(expression.left)) {
      return {
        statementType: SkittlesStatementType.VariableUpdate,
        variable: getNodeName(expression.left),
        value: getAssignmentValue(expression, interfaces, constants),
      };
    }
    throw new Error(`Unknown binary expression type: ${expression.kind}`);
  }
  if (isCallExpression(expression)) {
    const callExpression = expression.expression;
    if (isPropertyAccessExpression(callExpression)) {
      const target = getNodeName(callExpression);

      // Handle events
      if (target === "emit") {
        const eventName = getNodeName(callExpression.expression);
        const event = events.find((event) => event.label === eventName);
        if (!event) throw new Error(`Could not find event ${eventName}`);

        const args: SkittlesValue[] = [];
        expression.arguments.forEach((argument) => {
          if (isObjectLiteralExpression(argument)) {
            argument.properties.forEach((property) => {
              if (isPropertyAssignment(property)) {
                args.push({
                  name: getNodeName(property.name),
                  value: getSkittlesExpression(property.initializer, interfaces, constants),
                });
              } else if (isShorthandPropertyAssignment(property)) {
                args.push({
                  name: getNodeName(property.name),
                  value: getSkittlesExpression(property.name, interfaces, constants),
                });
              } else {
                throw new Error(`Unknown argument property type: ${property.kind}`);
              }
            });
            return {
              type: SkittlesStatementType.EmitEvent,
              event,
              args,
            };
          }
          throw new Error(`Unknown argument type: ${argument.kind}`);
        });

        return {
          statementType: SkittlesStatementType.EmitEvent,
          event,
          values: event.parameters.map((parameter) => {
            const arg = args.find((arg) => arg.name === parameter.name);
            if (!arg) throw new Error(`Could not find arg ${parameter.name}`);
            return arg.value;
          }),
        };
      }

      // Handle other calls
      return {
        statementType: SkittlesStatementType.Call,
        target,
        element: getSkittlesExpression(callExpression.expression, interfaces, constants),
        parameters: expression.arguments.map((e) =>
          getSkittlesExpression(e, interfaces, constants)
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
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants,
  events: SkittlesEventType[]
): SkittlesStatement => {
  const { expression, thenStatement, elseStatement } = statement;
  if (!thenStatement) throw new Error("If statement has no then statement");
  return {
    statementType: SkittlesStatementType.If,
    condition: getSkittlesExpression(expression, interfaces, constants),
    then: getSkittlesStatements(
      thenStatement,
      {
        kind: SkittlesTypeKind.Void,
      },
      interfaces,
      constants,
      events
    ),
    else: getSkittlesStatements(
      elseStatement,
      {
        kind: SkittlesTypeKind.Void,
      },
      interfaces,
      constants,
      events
    ),
  };
};

const getThrowStatement = (
  statement: ThrowStatement,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesStatement => {
  const { expression } = statement;
  if (isNewExpression(expression)) {
    const args = expression.arguments;
    if (!args) throw new Error("Throw statement has no arguments");
    if (args.length === 0) throw new Error("Throw statement has no arguments");
    if (args.length > 1) throw new Error("Throw statement has too many arguments");
    return {
      statementType: SkittlesStatementType.Throw,
      error: getSkittlesExpression(args[0], interfaces, constants),
    };
  }
  throw new Error("Not implemented throw statement handling");
};

const getVariableStatement = (
  statement: VariableStatement,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesStatement[] => {
  const { declarationList } = statement;
  return declarationList.declarations.map((declaration) => {
    const { name, initializer } = declaration;
    if (!initializer) throw new Error("Variable statement has no initializer");
    return {
      statementType: SkittlesStatementType.VariableDeclaration,
      variable: getNodeName(name),
      value: getSkittlesExpression(initializer, interfaces, constants),
    };
  });
};

const getIdentifierStatement = (
  statement: Identifier,
  returnType: SkittlesType,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesStatement => {
  return {
    statementType: SkittlesStatementType.Return,
    type: returnType,
    value: getSkittlesExpression(statement, interfaces, constants),
  };
};

const getConditionalExpressionStatement = (
  statement: ConditionalExpression,
  returnType: SkittlesType,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesStatement => {
  return {
    statementType: SkittlesStatementType.Return,
    type: returnType,
    value: getSkittlesExpression(statement, interfaces, constants),
  };
};

const getBaseSkittlesStatement = (
  node: Node,
  returnType: SkittlesType,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants,
  events: SkittlesEventType[]
): SkittlesStatement[] => {
  if (isExpressionStatement(node)) {
    return [getExpressionStatement(node, interfaces, constants, events)];
  }
  if (isReturnStatement(node)) {
    const { expression } = node;
    if (!expression) throw new Error("Return statement has no expression");
    return [getReturnStatement(expression, returnType, interfaces, constants)];
  }
  if (isIfStatement(node)) {
    return [getIfStatement(node, interfaces, constants, events)];
  }
  if (isThrowStatement(node)) {
    return [getThrowStatement(node, interfaces, constants)];
  }
  if (isExpression(node)) {
    return [getReturnStatement(node as Expression, returnType, interfaces, constants)];
  }
  if (isVariableStatement(node)) {
    return getVariableStatement(node, interfaces, constants);
  }
  if (isIdentifier(node)) {
    return [getIdentifierStatement(node, returnType, interfaces, constants)];
  }
  if (isConditionalExpression(node)) {
    return [getConditionalExpressionStatement(node, returnType, interfaces, constants)];
  }
  if (isLiteralExpression(node)) {
    return [getReturnStatement(node as Expression, returnType, interfaces, constants)];
  }
  if (isParenthesizedExpression(node)) {
    return [getReturnStatement(node.expression, returnType, interfaces, constants)];
  }
  throw new Error(`Unknown statement type: ${node.kind}`);
};

const getSkittlesStatement = (
  node: Node,
  returnType: SkittlesType,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants,
  events: SkittlesEventType[]
): SkittlesStatement[] => {
  const base = getBaseSkittlesStatement(node, returnType, interfaces, constants, events);
  return extractConditionalExpressionStatements(base);
};

export default getSkittlesStatements;
