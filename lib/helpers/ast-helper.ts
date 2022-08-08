import { Node, SyntaxKind } from "typescript";

export const getNodeName = (node: Node): string => {
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
