import yulTemplate, { YulSection } from "./data/yul-template";
import { Abi } from "./get-abi";
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
  SkittlesMappingUpdateStatement,
  SkittlesCallStatement,
  SkittlesIfStatement,
  SkittlesThrowStatement,
} from "./types/skittles-class";

import { getVariables, subStringCount } from "./helpers/string-helper";

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
  uint256: "return256",
  bool: "returnBoolean",
  address: "return256",
  string: "returnString",
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
      const variables = expression.items.map((item) => getExpressionYul(item));
      return `${expression.variable}Storage(${variables.join(", ")})`;
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
  const { variable, items, value } = statement;
  const variables = items.map((item) => getExpressionYul(item));
  return [
    `                ${variable}Set(${variables.join(", ")}, ${getExpressionYul(
      value
    )})`,
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

const getThrowYul = (statement: SkittlesThrowStatement): string[] => {
  const { error } = statement;
  return [`                revert256(${getExpressionYul(error)})`];
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
    case SkittlesStatementType.Throw:
      return getThrowYul(statement);
    default:
      throw new Error(`Unsupported statement type ${statement}`);
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
      .map((input: SkittlesParameter) => `${input.name}Var`)
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
  return _addStorageLayout(yul, property, index, YulSection.StorageLayout);
};

const addConstructorStorageLayout = (
  yul: string[],
  property: SkittlesVariable,
  index: number
) => {
  return _addStorageLayout(
    yul,
    property,
    index,
    YulSection.ConstructorStorageLayout
  );
};

const _addStorageLayout = (
  yul: string[],
  property: SkittlesVariable,
  index: number,
  section: YulSection
) => {
  if (property.immutable) return yul;
  const { name, type } = property;
  if (type.includes("mapping")) {
    const mappings = subStringCount(type, "mapping");
    const variables = getVariables(mappings);
    const extraVars = variables.split(", ").slice(1);
    const extraVarsYul = [
      `            mstore(0, p)`,
      ...extraVars.map(
        (v: string, index: number) =>
          `            mstore(0x${index * 20}, ${v})`
      ),
      `            p := keccak256(0, 0x${mappings * 20})`,
    ];
    return addToSection(yul, section, [
      `        function ${name}Pos(${variables}) -> p {`,
      `            p := add(0x1000, a)`,
      ...(extraVars.length > 0 ? extraVarsYul : []),
      `        }`,
    ]);
  }
  return addToSection(yul, section, [
    `        function ${name}Pos() -> p { p := ${index} }`,
  ]);
};

const addStorageAccess = (
  yul: string[],
  property: SkittlesVariable,
  skittlesClass: SkittlesClass
) => {
  return _addStorageAccess(
    yul,
    property,
    YulSection.StorageAccess,
    skittlesClass
  );
};

const addConstructorStorageAccess = (
  yul: string[],
  property: SkittlesVariable,
  skittlesClass: SkittlesClass
) => {
  return _addStorageAccess(
    yul,
    property,
    YulSection.ConstructorStorageAccess,
    skittlesClass
  );
};

const _addStorageAccess = (
  yul: string[],
  property: SkittlesVariable,
  section: YulSection,
  skittlesClass: SkittlesClass
) => {
  const { name, type } = property;
  const initial = name.substring(0, 1);

  if (property.immutable) {
    let { value } = property;
    if (!value) {
      if (!skittlesClass.constructor) {
        throw new Error("No constructor to get storage value");
      }

      skittlesClass.constructor.statements.forEach(
        (statement: SkittlesStatement) => {
          const { statementType } = statement;
          if (statementType === SkittlesStatementType.StorageUpdate) {
            if (statement.variable === name) {
              if (
                statement.value.expressionType !== SkittlesExpressionType.Value
              ) {
                throw new Error(
                  "Issue setting readonly from constructor `setimmutable` not implemented yet"
                );
              }
              value = statement.value;
            }
          }
        }
      );
    }
    if (!value) throw new Error("No storage update to get storage value");
    return addToSection(yul, section, [
      `        function ${name}Storage() -> ${initial} {`,
      `            ${initial} := ${getExpressionYul(value)}`,
      `        }`,
    ]);
  }

  if (type.includes("mapping")) {
    const mappings = subStringCount(type, "mapping");
    const vars = getVariables(mappings);
    return addToSection(yul, section, [
      `        function ${name}Storage(${vars}) -> ${initial} {`,
      `            ${initial} := sload(${name}Pos(${vars}))`,
      `        }`,
      `        function ${name}Set(${vars}, value) {`,
      `            sstore(${name}Pos(${vars}), value)`,
      `        }`,
    ]);
  }

  return addToSection(yul, section, [
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
  const expression = getExpressionYul(property.value);
  return addToSection(yul, YulSection.Constructor, [
    property.type === "string"
      ? `        sstore(${index}, add(${expression}, ${
          (expression.length - 2) * 2
        }))`
      : `        sstore(${index}, ${expression})`,
  ]);
};

const getParameters = (
  parameters: SkittlesParameter[],
  className: string
): string[] => {
  return [
    `        let programSize := datasize("${className}")`,
    `        let argSize := sub(codesize(), programSize)`,
    `        codecopy(0, programSize, argSize)`,
    ...parameters.map(
      (input: SkittlesParameter, index: number) =>
        `        let ${input.name}Var := mload(${index * 32})`
    ),
  ];
};

const addConstructor = (yul: string[], skittlesClass: SkittlesClass) => {
  const { constructor } = skittlesClass;
  if (!constructor) return yul;
  let { parameters, statements } = constructor;
  statements = statements.filter((statement: SkittlesStatement) => {
    const { statementType } = statement;
    if (statementType !== SkittlesStatementType.StorageUpdate) return true;
    const variable = skittlesClass.variables.find(
      (v: SkittlesVariable) => v.name === statement.variable
    );
    if (!variable)
      throw new Error(`No variable found for ${statement.variable}`);
    return !variable.immutable;
  });
  return addToSection(yul, YulSection.Constructor, [
    ...getParameters(parameters, skittlesClass.name),
    ...getBlockYul(statements).map((statement) =>
      statement.replace("                ", "        ")
    ),
  ]);
};

const getYul = (skittlesClass: SkittlesClass, abi: Abi) => {
  // Getting base data
  let yul = getBaseYul(skittlesClass.name);

  // Adding properties
  skittlesClass.variables.forEach(
    (property: SkittlesVariable, index: number) => {
      yul = addPropertyDispatcher(yul, abi, property);
      yul = addStorageLayout(yul, property, index);
      yul = addConstructorStorageLayout(yul, property, index);
      yul = addStorageAccess(yul, property, skittlesClass);
      yul = addConstructorStorageAccess(yul, property, skittlesClass);
      yul = addValueInitializations(yul, property, index);
      // TODO Handle private properties
    }
  );

  // Adding constructor
  yul = addConstructor(yul, skittlesClass);

  // Adding methods
  skittlesClass.methods.forEach((method: SkittlesMethod) => {
    yul = addMethodDispatcher(yul, abi, method);
    yul = addMethodFunction(yul, method);
    // TODO Handle private methods
  });

  // forEachChild(ast, process);
  const output = yul.join("\n");
  return output;
};

export default getYul;
