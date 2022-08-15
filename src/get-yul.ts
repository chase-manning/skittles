import yulTemplate, { YulSection } from "./data/yul-template";
import { Abi, AbiParameter } from "./get-abi";
import getSelector from "./get-selector";
import SkittlesClass, {
  SkittlesBinaryExpression,
  SkittlesExpression,
  SkittlesExpressionType,
  SkittlesMethod,
  SkittlesOperator,
  SkittlesParameter,
  SkittlesVariable,
  SkittlesReturnStatement,
  SkittlesStatement,
  SkittlesStatementType,
  SkittlesStorageUpdateStatement,
} from "./types/skittles-class";

import fs from "fs";
import { writeFile } from "./helpers/file-helper";

const addToSection = (
  yul: string[],
  section: YulSection,
  lines: string[]
): string[] => {
  const sectionIndex = yul.findIndex((line) => line.includes(`- ${section} -`));
  if (sectionIndex === -1) {
    yul.push(`${section}:`);
    yul.push(...lines);
  } else {
    yul.splice(sectionIndex + 1, 0, ...lines);
  }
  return yul;
};

const decoderFunctions: Record<string, string> = {
  address: "decodeAsAddress",
  uint256: "decodeAsUint",
};
const returnFunctions: Record<string, string> = {
  uint256: "returnUint",
  boolean: "returnTrue",
};

const getBaseYul = (name: string): string[] => {
  const base = [...yulTemplate];
  base.unshift(`object "${name}" {`);
  return base;
};

const addPropertyDispatcher = (
  yul: string[],
  abi: any[],
  property: SkittlesVariable
): string[] => {
  const { name, type } = property;
  const selector = getSelector(abi, name);
  return addToSection(yul, YulSection.Dispatchers, [
    `            case ${selector} /* "${name}()" */ {`,
    `                ${returnFunctions[type]}(${name}Storage())`,
    `            }`,
  ]);
};

const addMethodDispatcher = (
  yul: string[],
  abi: any[],
  method: SkittlesMethod
): string[] => {
  const { name, parameters, returns } = method;
  const selector = getSelector(abi, name);
  return addToSection(yul, YulSection.Dispatchers, [
    `            case ${selector} /* "${name}(${parameters
      .map((p) => p.type)
      .join(",")})" */ {`,
    returns === "void"
      ? `                ${name}Function(${parameters
          .map(
            (input: SkittlesParameter, index: number) =>
              `${decoderFunctions[input.type]}(${index})`
          )
          .join(", ")})`
      : `                ${returnFunctions[returns]}(${name}Function())`,
    `            }`,
  ]);
};

const getBinaryYul = (expression: SkittlesBinaryExpression): string => {
  const { left, right, operator } = expression;
  switch (operator) {
    case SkittlesOperator.Plus:
      return `safeAdd(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.Minus:
      return `sub(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.Multiply:
      return `mul(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.Divide:
      return `div(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.Modulo:
      return `mod(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.Equals:
      return `eq(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.NotEquals:
      return `not(eq(${getExpressionYul(left)}, ${getExpressionYul(right)}))`;
    case SkittlesOperator.GreaterThan:
      return `gt(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.LessThan:
      return `lt(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.GreaterThanOrEqual:
      return `gte(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.LessThanOrEqual:
      return `lte(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.And:
      return `and(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.Or:
      return `or(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.Not:
      return `not(${getExpressionYul(left)})`;
    default:
      throw new Error(`Unsupported binary operator ${operator}`);
  }
};

const getExpressionYul = (expression: SkittlesExpression): string => {
  switch (expression.expressionType) {
    case SkittlesExpressionType.Binary:
      return getBinaryYul(expression);
    case SkittlesExpressionType.Value:
      return expression.value;
    case SkittlesExpressionType.Storage:
      return `${expression.variable}Storage()`;
    default:
      throw new Error("Unsupported expression");
  }
};

const getStorageUpdateYul = (
  statement: SkittlesStorageUpdateStatement
): string => {
  const { variable, value } = statement;
  return `                ${variable}Set(${getExpressionYul(value)})`;
};

const getReturnYul = (statement: SkittlesReturnStatement): string => {
  const { value } = statement;
  return `                v := ${getExpressionYul(value)}`;
};

const getStatementYul = (statement: SkittlesStatement): string => {
  switch (statement.statementType) {
    case SkittlesStatementType.StorageUpdate:
      return getStorageUpdateYul(statement);
    case SkittlesStatementType.Return:
      return getReturnYul(statement);
    default:
      throw new Error("Unsupported statement");
  }
};

const getBlockYul = (statements: SkittlesStatement[]): string[] => {
  return statements.map((statement) => getStatementYul(statement));
};

const addMethodFunction = (yul: string[], method: SkittlesMethod) => {
  const { name, parameters, returns, statements } = method;
  const hasReturn = returns !== "void";
  return addToSection(yul, YulSection.Functions, [
    `            function ${name}Function(${parameters
      .map((input: AbiParameter) => input.name)
      .join(", ")}) ${hasReturn ? `-> v ` : ""}{`,
    ...getBlockYul(statements),
    `            }`,
  ]);
};

const addStorageLayout = (
  yul: string[],
  property: SkittlesVariable,
  index: number
) => {
  const { name } = property;
  return addToSection(yul, YulSection.StorageLayout, [
    `            function ${name}Pos() -> p { p := ${index} }`,
  ]);
};

const addStorageAccess = (yul: string[], property: SkittlesVariable) => {
  const { name } = property;
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

const addValueInitializations = (
  yul: string[],
  property: SkittlesVariable,
  index: number
) => {
  if (!property.value) return yul;
  return addToSection(yul, YulSection.Constructor, [
    `        sstore(${index}, ${getExpressionYul(property.value)})`,
  ]);
};

const getYul = (skittlesClass: SkittlesClass, abi: Abi, debug = false) => {
  // Getting base data
  let yul = getBaseYul(skittlesClass.name);

  // Adding properties
  skittlesClass.variables.forEach(
    (property: SkittlesVariable, index: number) => {
      yul = addPropertyDispatcher(yul, abi, property);
      yul = addStorageLayout(yul, property, index);
      yul = addStorageAccess(yul, property);
      yul = addValueInitializations(yul, property, index);
      // TODO Handle private properties
    }
  );

  // Adding methods
  skittlesClass.methods.forEach((method: SkittlesMethod) => {
    yul = addMethodDispatcher(yul, abi, method);
    yul = addMethodFunction(yul, method);
    // TODO Handle private methods
  });

  // forEachChild(ast, process);
  const output = yul.join("\n");
  if (debug) writeFile("yul", skittlesClass.name, output);
  return output;
};

export default getYul;
