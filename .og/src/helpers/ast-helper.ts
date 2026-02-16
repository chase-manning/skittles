import {
  BinaryExpression,
  ClassDeclaration,
  forEachChild,
  isArrowFunction,
  isBinaryExpression,
  isClassDeclaration,
  isElementAccessExpression,
  isImportDeclaration,
  isPrefixUnaryExpression,
  isPropertyAccessExpression,
  isPropertyDeclaration,
  Node,
  PropertyDeclaration,
  SourceFile,
  SyntaxKind,
} from "typescript";
import { relativePathToAbsolute } from "./file-helper";

export const getClassNodes = (node: Node): ClassDeclaration[] => {
  if (isClassDeclaration(node)) return [node];

  let classNodes: ClassDeclaration[] = [];
  forEachChild(node, (child) => {
    if (isClassDeclaration(child)) {
      classNodes.push(child);
    }
  });
  return classNodes;
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
    if (node.kind === SyntaxKind.PrivateKeyword || node.kind === SyntaxKind.ProtectedKeyword) {
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

export const getDependencies = (ast: SourceFile, sourceFile: string): string[] => {
  let dependencies: string[] = [];
  forEachChild(ast, (child) => {
    if (!isImportDeclaration(child)) return;
    const module = getNodeName(child.moduleSpecifier);
    if (module === "skittles") return;
    const absolutePath = relativePathToAbsolute(module, sourceFile);
    if (absolutePath.includes("core-types.ts")) return; // TODO Remove this
    dependencies.push(absolutePath);
  });
  return dependencies;
};
