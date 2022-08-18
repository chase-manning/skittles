import {
  Expression,
  forEachChild,
  isBinaryExpression,
  isLiteralExpression,
  isMethodDeclaration,
  isPropertyDeclaration,
  MethodDeclaration,
  PropertyDeclaration,
  SyntaxKind,
  Node,
  isPropertyAccessExpression,
  isParameter,
  isExpressionStatement,
  isReturnStatement,
  isIdentifier,
  isArrowFunction,
  ConstructorDeclaration,
  isConstructorDeclaration,
  ParameterDeclaration,
  ExpressionStatement,
} from "typescript";
import getAst from "./get-ast";
import {
  getClassNode,
  getNodeName,
  isEquals,
  isMinusEquals,
  isPlusEquals,
} from "./helpers/ast-helper";
import SkittlesClass, {
  SkittlesExpression,
  SkittlesExpressionType,
  SkittlesMethod,
  SkittlesOperator,
  SkittlesParameter,
  SkittlesVariable,
  SkittlesStatement,
  SkittlesStatementType,
  SkittlesConstructor,
} from "./types/skittles-class";

const getSkittlesType = (syntaxKind: SyntaxKind | undefined): string => {
  if (!syntaxKind) return "void";
  switch (syntaxKind) {
    case SyntaxKind.StringKeyword:
      return "string";
    case SyntaxKind.StringLiteral:
      return "string";
    case SyntaxKind.NumberKeyword:
      return "uint256";
    case SyntaxKind.NumericLiteral:
      return "uint256";
    case SyntaxKind.BooleanKeyword:
      return "boolean";
    case SyntaxKind.VoidKeyword:
      return "void";
    case SyntaxKind.AnyKeyword:
      return "any";
    default:
      throw new Error(`Unknown syntax kind: ${syntaxKind}`);
  }
};

const getSkittlesOperator = (syntaxKind: SyntaxKind): SkittlesOperator => {
  switch (syntaxKind) {
    case SyntaxKind.PlusToken:
      return SkittlesOperator.Plus;
    case SyntaxKind.MinusToken:
      return SkittlesOperator.Minus;
    case SyntaxKind.AsteriskToken:
      return SkittlesOperator.Multiply;
    case SyntaxKind.SlashToken:
      return SkittlesOperator.Divide;
    case SyntaxKind.PercentToken:
      return SkittlesOperator.Modulo;
    case SyntaxKind.AmpersandAmpersandToken:
      return SkittlesOperator.And;
    case SyntaxKind.BarBarToken:
      return SkittlesOperator.Or;
    case SyntaxKind.EqualsEqualsToken:
      return SkittlesOperator.Equals;
    case SyntaxKind.ExclamationEqualsToken:
      return SkittlesOperator.NotEquals;
    case SyntaxKind.LessThanToken:
      return SkittlesOperator.LessThan;
    case SyntaxKind.LessThanEqualsToken:
      return SkittlesOperator.LessThanOrEqual;
    case SyntaxKind.GreaterThanToken:
      return SkittlesOperator.GreaterThan;
    case SyntaxKind.GreaterThanEqualsToken:
      return SkittlesOperator.GreaterThanOrEqual;
    default:
      throw new Error(`Unknown syntax kind: ${syntaxKind}`);
  }
};

const getSkittlesExpression = (expression: Expression): SkittlesExpression => {
  if (isIdentifier(expression)) {
    return {
      expressionType: SkittlesExpressionType.Variable,
      value: expression.escapedText,
    };
  }
  if (isLiteralExpression(expression)) {
    return {
      expressionType: SkittlesExpressionType.Value,
      type: getSkittlesType(expression.kind),
      value: expression.text,
    };
  }
  if (isPropertyAccessExpression(expression)) {
    return {
      expressionType: SkittlesExpressionType.Storage,
      variable: getNodeName(expression),
    };
  }
  if (isBinaryExpression(expression)) {
    return {
      expressionType: SkittlesExpressionType.Binary,
      left: getSkittlesExpression(expression.left),
      right: getSkittlesExpression(expression.right),
      operator: getSkittlesOperator(expression.operatorToken.kind),
    };
  }
  throw new Error(`Unknown expression type: ${expression.kind}`);
};

const isNodePrivate = (node: Node): boolean => {
  let isPrivate = false;
  forEachChild(node, (node) => {
    if (node.kind === SyntaxKind.PrivateKeyword) {
      isPrivate = true;
    }
  });
  return isPrivate;
};

const getSkittlesProperty = (
  astProperty: PropertyDeclaration
): SkittlesVariable => {
  if (!astProperty.type) throw new Error("Could not get property type");
  const initializer = astProperty.initializer;
  return {
    name: getNodeName(astProperty),
    type: getSkittlesType(astProperty.type.kind),
    value: initializer ? getSkittlesExpression(initializer) : undefined,
    private: isNodePrivate(astProperty),
  };
};

const isNodeView = (node: Node): boolean => {
  let isView = true;
  forEachChild(node, (child) => {
    if (isBinaryExpression(child)) {
      if (isPropertyAccessExpression(child.left)) {
        if (isPlusEquals(child) || isEquals(child) || isMinusEquals(child)) {
          isView = false;
        }
      }
    }
    if (!isNodeView(child)) {
      isView = false;
    }
  });
  return isView;
};

export const getSkittlesParameters = (node: Node): SkittlesParameter[] => {
  const inputs: SkittlesParameter[] = [];
  forEachChild(node, (node) => {
    if (isParameter(node)) {
      inputs.push({
        name: getNodeName(node),
        type: getSkittlesType(node.type?.kind),
      });
    }
  });
  return inputs;
};

const getSkittlesStatements = (node: Node): SkittlesStatement[] => {
  const { body } = node as any;
  if (!body) return [];
  const { statements } = body;
  if (!statements) return [];
  const { type } = node as any;
  return statements.map((statement: ExpressionStatement) =>
    getSkittlesStatement(statement, getSkittlesType(type?.kind))
  );
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
      throw new Error(`Unknown binary expression type: ${expression.kind}`);
    }
    throw new Error("Not implemented expression statement handling");
  }
  if (isReturnStatement(node)) {
    const { expression } = node;
    if (!expression) throw new Error("Return statement has no expression");
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
    throw new Error(`Unknown return expression type: ${expression.kind}`);
  }
  throw new Error(`Unknown statement type: ${node.kind}`);
};

const getSkittlesMethod = (astMethod: MethodDeclaration): SkittlesMethod => {
  return {
    name: getNodeName(astMethod),
    returns: getSkittlesType(astMethod.type?.kind),
    private: isNodePrivate(astMethod),
    view: isNodeView(astMethod),
    parameters: getSkittlesParameters(astMethod),
    statements: getSkittlesStatements(astMethod),
  };
};

const isPropertyArrowFunction = (node: PropertyDeclaration): boolean => {
  if (!isPropertyDeclaration(node)) return false;
  if (!node.initializer) return false;
  return isArrowFunction(node.initializer);
};

const getSkittlesMethodFromArrowFunctionProperty = (
  astMethod: PropertyDeclaration
): SkittlesMethod => {
  if (!astMethod.initializer)
    throw new Error("Arrow function has no initializer");
  if (!isArrowFunction(astMethod.initializer))
    throw new Error("Not an arrow function");

  const arrowFunction = astMethod.initializer;
  return {
    name: getNodeName(astMethod),
    returns: getSkittlesType(arrowFunction.type?.kind),
    private: isNodePrivate(astMethod),
    view: isNodeView(arrowFunction),
    parameters: getSkittlesParameters(arrowFunction),
    statements: getSkittlesStatements(arrowFunction),
  };
};

const isVariable = (property: PropertyDeclaration): boolean => {
  return !isPropertyArrowFunction(property);
};

const getSkittlesConstructor = (
  astConstructor: ConstructorDeclaration
): SkittlesConstructor => {
  return {
    parameters: astConstructor.parameters.map(
      (parameter: ParameterDeclaration) => {
        return {
          name: getNodeName(parameter),
          type: getSkittlesType(parameter.type?.kind),
        };
      }
    ),
    statements: getSkittlesStatements(astConstructor),
  };
};

const getSkittlesClass = (file: string): SkittlesClass => {
  const ast = getAst(file);
  const classNode = getClassNode(ast);

  const astVariables = classNode.members
    .filter(isPropertyDeclaration)
    .filter(isVariable);

  const astMethods = classNode.members.filter(isMethodDeclaration);

  const astArrowFunctions = classNode.members
    .filter(isPropertyDeclaration)
    .filter(isPropertyArrowFunction);

  const astConstructor = classNode.members.find(isConstructorDeclaration);

  return {
    name: getNodeName(classNode),
    constructor: astConstructor
      ? getSkittlesConstructor(astConstructor)
      : undefined,
    variables: astVariables.map(getSkittlesProperty),
    methods: [
      ...astMethods.map(getSkittlesMethod),
      ...astArrowFunctions.map(getSkittlesMethodFromArrowFunctionProperty),
    ],
  };
};

export default getSkittlesClass;
