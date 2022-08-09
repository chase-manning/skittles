import {
  forEachChild,
  isClassDeclaration,
  isMethodDeclaration,
  isPropertyDeclaration,
  MethodDeclaration,
  Node,
  PropertyDeclaration,
} from "typescript";
import getAst from "./get-ast";
import fs from "fs";
import yulTemplate, { addToSection, YulSection } from "./data/yul-template";
import getAbi, { AbiParameter } from "./get-abi";
import {
  getNodeInputs,
  getNodeName,
  getNodeReturnType,
} from "./helpers/ast-helper";
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

const getMethods = (node: Node): MethodDeclaration[] => {
  const methods: MethodDeclaration[] = [];
  node.forEachChild((node) => {
    if (isMethodDeclaration(node)) {
      methods.push(node);
    }
  });
  return methods;
};

const addPropertyDispatcher = (
  yul: string[],
  abi: any[],
  property: PropertyDeclaration
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

const addMethodDispatcher = (
  yul: string[],
  abi: any[],
  property: MethodDeclaration
): string[] => {
  const decoderFunctions: Record<string, string> = {
    address: "decodeAsAddress",
    uint256: "decodeAsUint",
  };
  const returnFunctions: Record<string, string> = {
    uint256: "returnUint",
    boolean: "returnTrue",
  };
  const name = getNodeName(property);
  const returnType = getNodeReturnType(property);
  const selector = getSelector(abi, name);
  const inputs = getNodeInputs(property);
  return addToSection(yul, YulSection.Dispatchers, [
    `            case ${selector} /* "${name}(${inputs.join(",")})" */ {`,
    returnType === "void"
      ? `                ${name}Function(${inputs
          .map(
            (input: AbiParameter, index: number) =>
              `${decoderFunctions[input.type]}(${index})`
          )
          .join(", ")})`
      : `                ${returnFunctions[returnType]}(${name}Storage())`,
    `            }`,
  ]);
};

const addMethodFunction = (yul: string[], method: MethodDeclaration) => {
  const name = getNodeName(method);
  const inputs = getNodeInputs(method);
  return addToSection(yul, YulSection.Functions, [
    `            function ${name}Function(${inputs
      .map((input: AbiParameter) => input.name)
      .join(", ")}) {`,
    `            }`,
  ]);
};

const addStorageLayout = (
  yul: string[],
  property: PropertyDeclaration,
  index: number
) => {
  const name = getNodeName(property);
  return addToSection(yul, YulSection.StorageLayout, [
    `            function ${name}Pos() -> p { p := ${index} }`,
  ]);
};

const addStorageAccess = (yul: string[], property: PropertyDeclaration) => {
  const name = getNodeName(property);
  const initial = name.substring(0, 1);
  return addToSection(yul, YulSection.StorageAccess, [
    `            function ${name}Storage() -> ${initial} {`,
    `                ${initial} := sload(${name}Pos())`,
    `            }`,
    `            function ${name}Set(value) {`,
    `                sstore(${name}Pos(), value)`,
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
  properties.forEach((property: PropertyDeclaration, index: number) => {
    yul = addPropertyDispatcher(yul, abi, property);
    yul = addStorageLayout(yul, property, index);
    yul = addStorageAccess(yul, property);
    // TODO Handle private properties
  });

  // Adding methods
  const methods = getMethods(classNode);
  methods.forEach((method: MethodDeclaration) => {
    yul = addMethodDispatcher(yul, abi, method);
    yul = addMethodFunction(yul, method);
    // TODO Handle private methods
  });

  // forEachChild(ast, process);
  writeFile(yul);
};

export default getYul;
