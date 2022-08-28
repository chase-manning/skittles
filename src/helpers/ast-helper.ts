import {
  BinaryExpression,
  ClassDeclaration,
  forEachChild,
  isArrowFunction,
  isBinaryExpression,
  isClassDeclaration,
  isElementAccessExpression,
  isPrefixUnaryExpression,
  isPropertyAccessExpression,
  isPropertyDeclaration,
  Node,
  PropertyDeclaration,
  SyntaxKind,
} from "typescript";

export const getClassNode = (node: Node): ClassDeclaration => {
  if (isClassDeclaration(node)) {
    return node;
  }
  let classNode: ClassDeclaration | undefined = undefined;
  forEachChild(node, (child) => {
    if (isClassDeclaration(child)) {
      classNode = child;
    }
  });
  if (!classNode) throw new Error("Could not find class");
  return classNode;
};

export const getNodeName = (node: Node): string => {
  if ((node as any).text) return (node as any).text;
  if ((node as any).escapedText) return (node as any).escapedText;
  return (node as any).name.escapedText;
};

export const isPlusEquals = (expression: BinaryExpression): boolean => {
  return expression.operatorToken.kind === SyntaxKind.PlusEqualsToken;
};

export const isEquals = (expression: BinaryExpression): boolean => {
  return expression.operatorToken.kind === SyntaxKind.EqualsToken;
};

export const isMinusEquals = (expression: BinaryExpression): boolean => {
  return expression.operatorToken.kind === SyntaxKind.MinusEqualsToken;
};

export const isTrueKeyword = (node: Node): boolean => {
  return node.kind === SyntaxKind.TrueKeyword;
};

export const isFalseKeyword = (node: Node): boolean => {
  return node.kind === SyntaxKind.FalseKeyword;
};

export const isNodePrivate = (node: Node): boolean => {
  let isPrivate = false;
  forEachChild(node, (node) => {
    if (
      node.kind === SyntaxKind.PrivateKeyword ||
      node.kind === SyntaxKind.ProtectedKeyword
    ) {
      isPrivate = true;
    }
  });
  return isPrivate;
};

export const isNodeImmutable = (node: Node): boolean => {
  let isImmutable = false;
  forEachChild(node, (node) => {
    if (node.kind === SyntaxKind.ReadonlyKeyword) {
      isImmutable = true;
    }
  });
  return isImmutable;
};

export const isPropertyArrowFunction = (node: PropertyDeclaration): boolean => {
  if (!isPropertyDeclaration(node)) return false;
  if (!node.initializer) return false;
  return isArrowFunction(node.initializer);
};

export const isVariable = (property: PropertyDeclaration): boolean => {
  return !isPropertyArrowFunction(property);
};

export const isExpression = (node: Node): boolean => {
  return (
    isBinaryExpression(node) ||
    isTrueKeyword(node) ||
    isFalseKeyword(node) ||
    isPropertyAccessExpression(node) ||
    isElementAccessExpression(node) ||
    isPrefixUnaryExpression(node)
  );
};
