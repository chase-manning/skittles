import yulTemplate, { addToSection, YulSection } from "./data/yul-template";
import getAbi, { AbiParameter } from "./get-abi";
import getSelector from "./get-selector";
import getFoxClass from "./get-fox-class";
import {
  FoxBinaryExpression,
  FoxExpression,
  FoxExpressionType,
  FoxMethod,
  FoxOperator,
  FoxParameter,
  FoxProperty,
  FoxReturnStatement,
  FoxStatement,
  FoxStatementType,
  FoxStorageUpdateStatement,
} from "./types/fox-class";

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

const addPropertyDispatcher = (
  yul: string[],
  abi: any[],
  property: FoxProperty
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
  method: FoxMethod
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
            (input: FoxParameter, index: number) =>
              `${decoderFunctions[input.type]}(${index})`
          )
          .join(", ")})`
      : `                ${returnFunctions[returns]}(${name}Function())`,
    `            }`,
  ]);
};

const getBinaryYul = (expression: FoxBinaryExpression): string => {
  const { left, right, operator } = expression;
  switch (operator) {
    case FoxOperator.Plus:
      return `safeAdd(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case FoxOperator.Minus:
      return `sub(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case FoxOperator.Multiply:
      return `mul(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case FoxOperator.Divide:
      return `div(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case FoxOperator.Modulo:
      return `mod(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case FoxOperator.Equals:
      return `eq(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case FoxOperator.NotEquals:
      return `not(eq(${getExpressionYul(left)}, ${getExpressionYul(right)}))`;
    case FoxOperator.GreaterThan:
      return `gt(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case FoxOperator.LessThan:
      return `lt(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case FoxOperator.GreaterThanOrEqual:
      return `gte(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case FoxOperator.LessThanOrEqual:
      return `lte(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case FoxOperator.And:
      return `and(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case FoxOperator.Or:
      return `or(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case FoxOperator.Not:
      return `not(${getExpressionYul(left)})`;
    default:
      throw new Error(`Unsupported binary operator ${operator}`);
  }
};

const getExpressionYul = (expression: FoxExpression): string => {
  switch (expression.expressionType) {
    case FoxExpressionType.Binary:
      return getBinaryYul(expression);
    case FoxExpressionType.Value:
      return expression.value;
    case FoxExpressionType.Storage:
      return `${expression.variable}Storage()`;
    default:
      throw new Error("Unsupported expression");
  }
};

const getStorageUpdateYul = (statement: FoxStorageUpdateStatement): string => {
  const { variable, value } = statement;
  return `                ${variable}Set(${getExpressionYul(value)})`;
};

const getReturnYul = (statement: FoxReturnStatement): string => {
  const { value } = statement;
  return `                v := ${getExpressionYul(value)}`;
};

const getStatementYul = (statement: FoxStatement): string => {
  switch (statement.statementType) {
    case FoxStatementType.StorageUpdate:
      return getStorageUpdateYul(statement);
    case FoxStatementType.Return:
      return getReturnYul(statement);
    default:
      throw new Error("Unsupported statement");
  }
};

const getBlockYul = (statements: FoxStatement[]): string[] => {
  return statements.map((statement) => getStatementYul(statement));
};

const addMethodFunction = (yul: string[], method: FoxMethod) => {
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
  property: FoxProperty,
  index: number
) => {
  const { name } = property;
  return addToSection(yul, YulSection.StorageLayout, [
    `            function ${name}Pos() -> p { p := ${index} }`,
  ]);
};

const addStorageAccess = (yul: string[], property: FoxProperty) => {
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

const getYul = (file: string) => {
  // Getting base data
  const foxClass = getFoxClass(file);
  const abi = getAbi(foxClass);
  let yul = getBaseYul(foxClass.name);

  // Adding properties
  foxClass.properties.forEach((property: FoxProperty, index: number) => {
    yul = addPropertyDispatcher(yul, abi, property);
    yul = addStorageLayout(yul, property, index);
    yul = addStorageAccess(yul, property);
    // TODO Handle private properties
  });

  // Adding methods
  foxClass.methods.forEach((method: FoxMethod) => {
    yul = addMethodDispatcher(yul, abi, method);
    yul = addMethodFunction(yul, method);
    // TODO Handle private methods
  });

  // forEachChild(ast, process);
  return yul.join("\n");
};

export default getYul;
