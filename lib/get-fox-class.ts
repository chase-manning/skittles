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
} from "typescript";
import getAst from "./get-ast";
import {
  getClassNode,
  getNodeName,
  isEquals,
  isMinusEquals,
  isPlusEquals,
} from "./helpers/ast-helper";
import FoxClass, {
  FoxExpression,
  FoxExpressionType,
  FoxMethod,
  FoxOperator,
  FoxParameter,
  FoxProperty,
  FoxStatement,
  FoxStatementType,
} from "./types/fox-class";

const getFoxType = (syntaxKind: SyntaxKind | undefined): string => {
  if (!syntaxKind) return "void";
  switch (syntaxKind) {
    case SyntaxKind.StringKeyword:
      return "string";
    case SyntaxKind.NumberKeyword:
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

const getFoxOperator = (syntaxKind: SyntaxKind): FoxOperator => {
  switch (syntaxKind) {
    case SyntaxKind.PlusToken:
      return FoxOperator.Plus;
    case SyntaxKind.MinusToken:
      return FoxOperator.Minus;
    case SyntaxKind.AsteriskToken:
      return FoxOperator.Multiply;
    case SyntaxKind.SlashToken:
      return FoxOperator.Divide;
    case SyntaxKind.PercentToken:
      return FoxOperator.Modulo;
    case SyntaxKind.AmpersandAmpersandToken:
      return FoxOperator.And;
    case SyntaxKind.BarBarToken:
      return FoxOperator.Or;
    case SyntaxKind.EqualsEqualsToken:
      return FoxOperator.Equals;
    case SyntaxKind.ExclamationEqualsToken:
      return FoxOperator.NotEquals;
    case SyntaxKind.LessThanToken:
      return FoxOperator.LessThan;
    case SyntaxKind.LessThanEqualsToken:
      return FoxOperator.LessThanOrEqual;
    case SyntaxKind.GreaterThanToken:
      return FoxOperator.GreaterThan;
    case SyntaxKind.GreaterThanEqualsToken:
      return FoxOperator.GreaterThanOrEqual;
    default:
      throw new Error(`Unknown syntax kind: ${syntaxKind}`);
  }
};

const getFoxExpression = (expression: Expression): FoxExpression => {
  if (isLiteralExpression(expression)) {
    return {
      expressionType: FoxExpressionType.Value,
      value: expression.text,
    };
  }
  if (isIdentifier(expression)) {
    return {
      expressionType: FoxExpressionType.Value,
      value: expression.escapedText,
    };
  }
  if (isPropertyAccessExpression(expression)) {
    return {
      expressionType: FoxExpressionType.Storage,
      variable: getNodeName(expression),
    };
  }
  if (isBinaryExpression(expression)) {
    return {
      expressionType: FoxExpressionType.Binary,
      left: getFoxExpression(expression.left),
      right: getFoxExpression(expression.right),
      operator: getFoxOperator(expression.operatorToken.kind),
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

const getFoxProperty = (astProperty: PropertyDeclaration): FoxProperty => {
  if (!astProperty.type) throw new Error("Could not get property type");
  const initializer = astProperty.initializer;
  return {
    name: getNodeName(astProperty),
    type: getFoxType(astProperty.type.kind),
    value: initializer ? getFoxExpression(initializer) : undefined,
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

export const getFoxParameters = (node: Node): FoxParameter[] => {
  const inputs: FoxParameter[] = [];
  forEachChild(node, (node) => {
    if (isParameter(node)) {
      inputs.push({
        name: getNodeName(node),
        type: getFoxType(node.type?.kind),
      });
    }
  });
  return inputs;
};

const getFoxStatement = (node: Node, returnType: string): FoxStatement => {
  if (isExpressionStatement(node)) {
    const expression = node.expression;
    if (isBinaryExpression(expression)) {
      if (isPropertyAccessExpression(expression.left)) {
        if (isEquals(expression)) {
          return {
            statementType: FoxStatementType.StorageUpdate,
            variable: getNodeName(expression.left),
            value: getFoxExpression(expression.right),
          };
        }
        if (isPlusEquals(expression)) {
          return {
            statementType: FoxStatementType.StorageUpdate,
            variable: getNodeName(expression.left),
            value: {
              expressionType: FoxExpressionType.Binary,
              operator: FoxOperator.Plus,
              left: getFoxExpression(expression.left),
              right: getFoxExpression(expression.right),
            },
          };
        }
        if (isMinusEquals(expression)) {
          return {
            statementType: FoxStatementType.StorageUpdate,
            variable: getNodeName(expression.left),
            value: {
              expressionType: FoxExpressionType.Binary,
              operator: FoxOperator.Minus,
              left: getFoxExpression(expression.left),
              right: getFoxExpression(expression.right),
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
    const expression = node.expression;
    if (!expression) throw new Error("Return statement has no expression");
    if (isBinaryExpression(expression)) {
      return {
        statementType: FoxStatementType.Return,
        type: returnType,
        value: getFoxExpression(node.expression),
      };
    }
  }
  throw new Error(`Unknown statement type: ${node.kind}`);
};

const getFoxMethod = (astMethod: MethodDeclaration): FoxMethod => {
  return {
    name: getNodeName(astMethod),
    returns: getFoxType(astMethod.type?.kind),
    private: isNodePrivate(astMethod),
    view: isNodeView(astMethod),
    parameters: getFoxParameters(astMethod),
    statements:
      astMethod.body?.statements.map((statement) =>
        getFoxStatement(statement, getFoxType(astMethod.type?.kind))
      ) || [],
  };
};

const getFoxClass = (file: string): FoxClass => {
  const ast = getAst(file);
  const classNode = getClassNode(ast);
  const astProperties = classNode.members.filter(isPropertyDeclaration);
  const astMethods = classNode.members.filter(isMethodDeclaration);
  return {
    name: getNodeName(classNode),
    properties: astProperties.map(getFoxProperty),
    methods: astMethods.map(getFoxMethod),
  };
};

export default getFoxClass;
