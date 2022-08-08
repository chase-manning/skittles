import getAst from "./get-ast";

import {
  forEachChild,
  isMethodDeclaration,
  isParameter,
  isPropertyDeclaration,
  MethodDeclaration,
  Node,
  ParameterDeclaration,
  PropertyDeclaration,
  SourceFile,
  SyntaxKind,
} from "typescript";
import { getNodeName, getNodeReturnType } from "./helpers/ast-helper";

export interface AbiParameter {
  name: string;
  type: string; // TODO Add subtypes
}

export interface AbiFunction {
  type: "function" | "constructor" | "receive" | "fallback";
  name: string;
  inputs: AbiParameter[];
  outputs: AbiParameter[];
  stateMutability: "view" | "payable" | "nonpayable" | "pure";
}

export type Abi = AbiFunction[];

const isNodePrivate = (node: Node): boolean => {
  let isPrivate = false;
  forEachChild(node, (node) => {
    if (node.kind === SyntaxKind.PrivateKeyword) {
      isPrivate = true;
    }
  });
  return isPrivate;
};

const getOutputs = (
  node: MethodDeclaration | PropertyDeclaration
): AbiParameter[] => {
  const type = getNodeReturnType(node);
  if (type === "void") return [];
  // TODO Support multiple outputs
  return [
    {
      name: "",
      type,
    },
  ];
};

const getInput = (parameter: ParameterDeclaration): AbiParameter => {
  return {
    name: getNodeName(parameter),
    type: "uint256", // TODO Get the type for real
  };
};

const getInputs = (node: MethodDeclaration): AbiParameter[] => {
  const inputs: AbiParameter[] = [];
  forEachChild(node, (node) => {
    if (isParameter(node)) {
      inputs.push(getInput(node));
    }
  });
  return inputs;
};

const propertyDeclarationToAbi = (node: PropertyDeclaration): AbiFunction => {
  return {
    type: "function",
    name: getNodeName(node),
    inputs: [],
    outputs: getOutputs(node),
    stateMutability: "view",
  };
};

const methodDeclarationToAbi = (node: MethodDeclaration): AbiFunction => {
  return {
    type: "function",
    name: getNodeName(node),
    inputs: getInputs(node),
    outputs: getOutputs(node),
    stateMutability: "nonpayable", // TODO Work out if it's payable or not
  };
};

const processNode = (node: Node): Abi => {
  if (isNodePrivate(node)) return [];
  if (isPropertyDeclaration(node)) {
    return [propertyDeclarationToAbi(node)];
  }
  if (isMethodDeclaration(node)) {
    return [methodDeclarationToAbi(node)];
  }
  // TODO Add events
  // TODO Add errors
  const abi: Abi = [];
  node.forEachChild((node) => {
    abi.push(...processNode(node));
  });
  return abi;
};

const processAst = (sourceFile: SourceFile) => {
  const abi: Abi = [];
  sourceFile.forEachChild((node) => {
    abi.push(...processNode(node));
  });
  return abi;
};

const getAbi = (file: string): Abi => {
  const ast = getAst(file);
  return processAst(ast);
};

export default getAbi;
