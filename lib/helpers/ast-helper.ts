import {
  BinaryExpression,
  ClassDeclaration,
  forEachChild,
  isClassDeclaration,
  isParameter,
  Node,
  SyntaxKind,
} from "typescript";
import { AbiParameter } from "../get-abi";

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

export const getNodeReturnType = (node: Node): string => {
  const type = (node as any).type;
  if (!type) return "void";
  if (type.kind === SyntaxKind.NumberKeyword) {
    return "uint256";
  }
  if (type.kind === SyntaxKind.VoidKeyword) {
    return "void";
  }
  // TODO Add more types
  throw new Error("Unsupported type");
};

export const getNodeOutputs = (node: Node): string[] => {
  const type = getNodeReturnType(node);
  if (type === "void") return [];
  // TODO Support multiple outputs
  return [type];
};

export const getNodeInputs = (node: Node): AbiParameter[] => {
  const inputs: AbiParameter[] = [];
  forEachChild(node, (node) => {
    if (isParameter(node)) {
      inputs.push({ name: getNodeName(node), type: "uint256" }); // TODO Get the type for real
    }
  });
  return inputs;
};

export const isPlusEquals = (expression: BinaryExpression): boolean => {
  return expression.operatorToken.kind === SyntaxKind.PlusEqualsToken;
};

export const isAsteriskToken = (expression: BinaryExpression): boolean => {
  return expression.operatorToken.kind === SyntaxKind.AsteriskToken;
};

export const isEquals = (expression: BinaryExpression): boolean => {
  return expression.operatorToken.kind === SyntaxKind.EqualsToken;
};

export const isMinusEquals = (expression: BinaryExpression): boolean => {
  return expression.operatorToken.kind === SyntaxKind.MinusEqualsToken;
};
