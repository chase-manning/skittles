import {
  forEachChild,
  isClassDeclaration,
  isPropertyDeclaration,
  MethodDeclaration,
  Node,
  PropertyDeclaration,
} from "typescript";
import getAst from "./get-ast";
import fs from "fs";
import yulTemplate, { addToSection, YulSection } from "./data/yul-template";
import getAbi from "./get-abi";
import { getNodeName, getNodeReturnType } from "./helpers/ast-helper";
import getSelector from "./get-selector";

const getBaseYul = (name: string): string[] => {
  const base = yulTemplate;
  base.unshift(`object "${name}" {`);
  return base;
};

const getClass = (node: Node): Node => {
  let classNode: Node | undefined = undefined;
  // Only consider exported nodes
  forEachChild(node, (node) => {
    if (isClassDeclaration(node)) {
      classNode = node;
    }
  });
  if (!classNode) throw new Error("Could not find class");
  return classNode;
};

const getProperties = (node: Node): PropertyDeclaration[] => {
  const properties: PropertyDeclaration[] = [];
  node.forEachChild((node) => {
    if (isPropertyDeclaration(node)) {
      properties.push(node);
    }
  });
  return properties;
};

const addDispatcher = (
  yul: string[],
  abi: any[],
  property: PropertyDeclaration | MethodDeclaration
): string[] => {
  const returnFunctions: Record<string, string> = {
    uint256: "returnUint",
    boolean: "returnTrue",
  };
  const name = getNodeName(property);
  const returnType = getNodeReturnType(property);
  const selector = getSelector(abi, name);
  return addToSection(yul, YulSection.Dispatchers, [
    `            case ${selector} /* "${name}()" */ {`,
    `                ${returnFunctions[returnType]}(${name}Storage())`,
    `            }`,
  ]);
};

const writeFile = (file: string[]) => {
  fs.writeFileSync("./output.yul", file.join("\n"));
};

const getYul = (file: string) => {
  // Getting base data
  const abi = getAbi(file);
  const ast = getAst(file);
  const classNode = getClass(ast);
  const contractName = getNodeName(classNode);
  let yul = getBaseYul(contractName);

  // Adding properties
  const properties = getProperties(classNode);
  properties.forEach((property: PropertyDeclaration) => {
    yul = addDispatcher(yul, abi, property);
    // TODO Handle private properties
  });

  // forEachChild(ast, process);
  writeFile(yul);
};

export default getYul;
