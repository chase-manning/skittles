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
  SkittlesConstructor,
  SkittlesMappingUpdateStatement,
  SkittlesCallStatement,
  SkittlesIfStatement,
} from "./types/skittles-class";

import { writeFile } from "./helpers/file-helper";

const addToSection = (
  yul: string[],
  section: YulSection,
  lines: string[]
): string[] => {
  const sectionIndex = yul.findIndex((line) => line.includes(`- ${section} -`));
  if (sectionIndex === -1) return yul;
  yul.splice(sectionIndex + 1, 0, ...lines);
  return yul;
};

const decoderFunctions: Record<string, string> = {
  address: "decodeAsAddress",
  uint256: "decodeAsUint",
};

const returnFunctions: Record<string, string> = {
  uint256: "returnUint",
  bool: "returnBoolean",
  address: "returnAddress",
};

const evmDialects: Record<string, Record<string, string>> = {
  block: {
    coinbase: "coinbase()",
    difficulty: "difficulty()",
    block: "number()",
    prevhash: "",
    timestamp: "timestamp()",
  },
  chain: {
    id: "chainid()",
  },
  msg: {
    data: "",
    sender: "caller()",
    value: "callvalue()",
  },
  tx: {
    gasPrice: "gasprice()",
    origin: "origin()",
  },
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
  if (property.private) return yul;
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
  if (method.private) return yul;
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
      : `                ${
          returnFunctions[returns]
        }(${name}Function(${parameters
          .map(
            (input: SkittlesParameter, index: number) =>
              `${decoderFunctions[input.type]}(${index})`
          )
          .join(", ")}))`,
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
    case SkittlesExpressionType.Variable:
      return `${expression.value}Var`;
    case SkittlesExpressionType.Value:
      if (expression.type === "string") return `"${expression.value}"`;
      return expression.value;
    case SkittlesExpressionType.Storage:
      return `${expression.variable}Storage()`;
    case SkittlesExpressionType.Mapping:
      return `${expression.variable}Storage(${getExpressionYul(
        expression.item
      )})`;
    case SkittlesExpressionType.EvmDialect:
      return evmDialects[expression.environment][expression.variable];
    default:
      throw new Error("Unsupported expression");
  }
};

const getStorageUpdateYul = (
  statement: SkittlesStorageUpdateStatement
): string[] => {
  const { variable, value } = statement;
  return [`                ${variable}Set(${getExpressionYul(value)})`];
};

const getReturnYul = (statement: SkittlesReturnStatement): string[] => {
  const { value } = statement;
  return [`                v := ${getExpressionYul(value)}`];
};

const getMappingUpdateYul = (
  statement: SkittlesMappingUpdateStatement
): string[] => {
  const { variable, item, value } = statement;
  return [
    `                ${variable}Set(${getExpressionYul(
      item
    )}, ${getExpressionYul(value)})`,
  ];
};

const getCallYul = (statement: SkittlesCallStatement): string[] => {
  const { target, parameters } = statement;
  return [
    `                ${target}Function(${parameters
      .map(getExpressionYul)
      .join(", ")})`,
  ];
};

const getIfYul = (statement: SkittlesIfStatement): string[] => {
  const { condition, then } = statement;
  // TODO Add else support (needs to use switches)
  const statements = [];
  for (const statement of then) {
    statements.push(...getStatementYul(statement));
  }
  return [
    `                if ${getExpressionYul(condition)} {`,
    ...statements,
    `                }`,
  ];
};

const getStatementYul = (statement: SkittlesStatement): string[] => {
  switch (statement.statementType) {
    case SkittlesStatementType.StorageUpdate:
      return getStorageUpdateYul(statement);
    case SkittlesStatementType.Return:
      return getReturnYul(statement);
    case SkittlesStatementType.MappingUpdate:
      return getMappingUpdateYul(statement);
    case SkittlesStatementType.Call:
      return getCallYul(statement);
    case SkittlesStatementType.If:
      return getIfYul(statement);
    default:
      throw new Error("Unsupported statement");
  }
};

const getBlockYul = (statements: SkittlesStatement[]): string[] => {
  const yul = [];
  for (const statement of statements) {
    yul.push(...getStatementYul(statement));
  }
  return yul;
};

const addMethodFunction = (yul: string[], method: SkittlesMethod) => {
  const { name, parameters, returns, statements } = method;
  const hasReturn = returns !== "void";
  return addToSection(yul, YulSection.Functions, [
    `            function ${name}Function(${parameters
      .map((input: AbiParameter) => `${input.name}Var`)
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
  if (property.type.includes("mapping")) {
    return addToSection(yul, YulSection.StorageLayout, [
      `            function ${name}Pos(a) -> p { p := add(0x1000, a) }`,
    ]);
  }
  return addToSection(yul, YulSection.StorageLayout, [
    `            function ${name}Pos() -> p { p := ${index} }`,
  ]);
};

const addConstructorStorageLayout = (
  yul: string[],
  property: SkittlesVariable,
  index: number
) => {
  const { name } = property;
  if (property.type.includes("mapping")) {
    return addToSection(yul, YulSection.ConstructorStorageLayout, [
      `        function ${name}Pos(a) -> p { p := add(0x1000, a) }`,
    ]);
  }
  return addToSection(yul, YulSection.ConstructorStorageLayout, [
    `        function ${name}Pos() -> p { p := ${index} }`,
  ]);
};

const addStorageAccess = (yul: string[], property: SkittlesVariable) => {
  const { name } = property;
  const initial = name.substring(0, 1);
  if (property.type.includes("mapping")) {
    return addToSection(yul, YulSection.StorageAccess, [
      `            function ${name}Storage(a) -> ${initial} {`,
      `                ${initial} := sload(${name}Pos(a))`,
      `            }`,
      `            function ${name}Set(a, value) {`,
      `                sstore(${name}Pos(a), value)`,
      `            }`,
    ]);
  }
  return addToSection(yul, YulSection.StorageAccess, [
    `            function ${name}Storage() -> ${initial} {`,
    `                ${initial} := sload(${name}Pos())`,
    `            }`,
    `            function ${name}Set(value) {`,
    `                sstore(${name}Pos(), value)`,
    `            }`,
  ]);
};

const addConstructorStorageAccess = (
  yul: string[],
  property: SkittlesVariable
) => {
  const { name } = property;
  const initial = name.substring(0, 1);
  if (property.type.includes("mapping")) {
    return addToSection(yul, YulSection.ConstructorStorageAccess, [
      `        function ${name}Storage(a) -> ${initial} {`,
      `            ${initial} := sload(${name}Pos(a))`,
      `        }`,
      `        function ${name}Set(a, value) {`,
      `            sstore(${name}Pos(a), value)`,
      `        }`,
    ]);
  }
  return addToSection(yul, YulSection.ConstructorStorageAccess, [
    `        function ${name}Storage() -> ${initial} {`,
    `            ${initial} := sload(${name}Pos())`,
    `        }`,
    `        function ${name}Set(value) {`,
    `            sstore(${name}Pos(), value)`,
    `        }`,
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

const getParameters = (
  parameters: AbiParameter[],
  className: string
): string[] => {
  return [
    `        let programSize := datasize("${className}")`,
    `        let argSize := sub(codesize(), programSize)`,
    `        codecopy(0, programSize, argSize)`,
    ...parameters.map(
      (input: AbiParameter, index: number) =>
        `        let ${input.name}Var := mload(${index * 32})`
    ),
  ];
};

const addConstructor = (
  yul: string[],
  className: string,
  constructor?: SkittlesConstructor
) => {
  if (!constructor) return yul;
  const { parameters, statements } = constructor;
  return addToSection(yul, YulSection.Constructor, [
    ...getParameters(parameters, className),
    ...getBlockYul(statements).map((statement) =>
      statement.replace("                ", "        ")
    ),
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
      yul = addConstructorStorageLayout(yul, property, index);
      yul = addStorageAccess(yul, property);
      yul = addConstructorStorageAccess(yul, property);
      yul = addValueInitializations(yul, property, index);
      // TODO Handle private properties
    }
  );

  // Adding constructor
  yul = addConstructor(yul, skittlesClass.name, skittlesClass.constructor);

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
