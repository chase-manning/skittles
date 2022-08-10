import {
  BinaryExpression,
  Block,
  ExpressionStatement,
  forEachChild,
  isBinaryExpression,
  isClassDeclaration,
  isExpressionStatement,
  isIdentifier,
  isMethodDeclaration,
  isPropertyAccessExpression,
  isPropertyDeclaration,
  isReturnStatement,
  MethodDeclaration,
  Node,
  PropertyDeclaration,
  ReturnStatement,
} from "typescript";
import getAst from "./get-ast";
import fs from "fs";
import yulTemplate, { addToSection, YulSection } from "./data/yul-template";
import getAbi, { AbiParameter } from "./get-abi";
import {
  getNodeInputs,
  getNodeName,
  getNodeOutputs,
  getNodeReturnType,
  isAsteriskToken,
  isPlusEquals,
} from "./helpers/ast-helper";
import getSelector from "./get-selector";

const decoderFunctions: Record<string, string> = {
  address: "decodeAsAddress",
  uint256: "decodeAsUint",
};
const returnFunctions: Record<string, string> = {
  uint256: "returnUint",
  boolean: "returnTrue",
};

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
      : `                ${returnFunctions[returnType]}(${name}Function())`,
    `            }`,
  ]);
};

const getNodeIdentifyer = (node: Node): string => {
  if (isPropertyAccessExpression(node)) {
    return `${getNodeName(node)}Storage()`;
  }
  return getNodeName(node);
};

const getPlusEqualsYul = (expression: BinaryExpression): string => {
  if (isIdentifier(expression.left)) {
    const left = getNodeIdentifyer(expression.left);
    const right = getNodeIdentifyer(expression.right);
    return `                ${left} := safeAdd(${left}, ${right})`;
  }
  if (isPropertyAccessExpression(expression.left)) {
    const left = getNodeIdentifyer(expression.left);
    const right = getNodeIdentifyer(expression.right);
    return `                ${getNodeName(
      expression.left
    )}Set(safeAdd(${left}, ${right}))`;
  }
  throw new Error("Unsupported plus equals expression left");
};

const getAsteriskTokenYul = (expression: BinaryExpression): string => {
  return `mul(${getNodeIdentifyer(expression.left)}, ${getNodeIdentifyer(
    expression.right
  )})`;
};

const getBinaryExpressionYul = (expression: BinaryExpression): string => {
  if (isPlusEquals(expression)) {
    return getPlusEqualsYul(expression);
  }
  if (isAsteriskToken(expression)) {
    return getAsteriskTokenYul(expression);
  }
  throw new Error("Unsupported binary expression");
};

const getExpressionStatementYul = (statement: ExpressionStatement): string => {
  const expression = statement.expression;
  if (isBinaryExpression(expression)) {
    return getBinaryExpressionYul(expression);
  }
  throw new Error("Unsupported expression");
};

const getReturnStatementYul = (
  statement: ReturnStatement,
  v: string
): string => {
  const expression = statement.expression;
  if (!expression) throw new Error("Unsupported expression statement");
  if (isBinaryExpression(expression)) {
    return `                v := ${getBinaryExpressionYul(expression)}`;
  }
  throw new Error("Unsupported return statement");
};

const getStatementYul = (statement: Node, v: string): string => {
  if (isExpressionStatement(statement)) {
    return getExpressionStatementYul(statement);
  }
  if (isReturnStatement(statement)) {
    return getReturnStatementYul(statement, v);
  }
  throw new Error("Unsupported statement");
};

const getBlockYul = (block: Block | undefined, v: string): string[] => {
  if (!block) return [];
  return block.statements.map((statement) => getStatementYul(statement, v));
};

const addMethodFunction = (yul: string[], method: MethodDeclaration) => {
  const name = getNodeName(method);
  const inputs = getNodeInputs(method);
  const outputs = getNodeOutputs(method);
  return addToSection(yul, YulSection.Functions, [
    `            function ${name}Function(${inputs
      .map((input: AbiParameter) => input.name)
      .join(", ")}) ${outputs.length > 0 ? `-> v ` : ""}{`,
    ...getBlockYul(method.body, outputs.length > 0 ? outputs[0] : "void"),
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
