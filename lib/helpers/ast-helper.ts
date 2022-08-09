import { forEachChild, isParameter, Node, SyntaxKind } from "typescript";
import { AbiParameter } from "../get-abi";

export const getNodeName = (node: Node): string => {
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
