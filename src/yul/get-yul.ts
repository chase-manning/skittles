import yulTemplate, { YulSection } from "../data/yul-template";
import SkittlesClass, {
  SkittlesExpressionType,
  SkittlesMethod,
  SkittlesParameter,
  SkittlesVariable,
  SkittlesStatement,
  SkittlesStatementType,
} from "../types/skittles-class";

import { getVariables, subStringCount } from "../helpers/string-helper";
import getSelector from "../helpers/selector-helper";
import { Abi } from "../types/abi-types";
import { returnFunctions, decoderFunctions } from "./yul-constants";
import getExpressionYul from "./get-expression-yul";
import getStatementYul from "./get-statement-yul";

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
    `case ${selector} /* "${name}()" */ {`,
    `${returnFunctions[type]}(${name}Storage())`,
    `}`,
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
    `case ${selector} /* "${name}(${parameters
      .map((p) => p.type)
      .join(",")})" */ {`,
    returns === "void"
      ? `${name}Function(${parameters
          .map(
            (input: SkittlesParameter, index: number) =>
              `${decoderFunctions[input.type]}(${index})`
          )
          .join(", ")})`
      : `${returnFunctions[returns]}(${name}Function(${parameters
          .map(
            (input: SkittlesParameter, index: number) =>
              `${decoderFunctions[input.type]}(${index})`
          )
          .join(", ")}))`,
    `}`,
  ]);
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
    `function ${name}Function(${parameters
      .map((input: SkittlesParameter) => `${input.name}Var`)
      .join(", ")}) ${hasReturn ? `-> v ` : ""}{`,
    ...getBlockYul(statements),
    `}`,
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
      `mstore(0, p)`,
      ...extraVars.map(
        (v: string, index: number) => `mstore(0x${index * 20}, ${v})`
      ),
      `p := keccak256(0, 0x${mappings * 20})`,
    ];
    return addToSection(yul, section, [
      `function ${name}Pos(${variables}) -> p {`,
      `p := add(0x1000, a)`,
      ...(extraVars.length > 0 ? extraVarsYul : []),
      `}`,
    ]);
  }
  return addToSection(yul, section, [
    `function ${name}Pos() -> p { p := ${index} }`,
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
      `function ${name}Storage() -> ${initial} {`,
      `${initial} := ${getExpressionYul(value)}`,
      `}`,
    ]);
  }

  if (type.includes("mapping")) {
    const mappings = subStringCount(type, "mapping");
    const vars = getVariables(mappings);
    return addToSection(yul, section, [
      `function ${name}Storage(${vars}) -> ${initial} {`,
      `${initial} := sload(${name}Pos(${vars}))`,
      `}`,
      `function ${name}Set(${vars}, value) {`,
      `sstore(${name}Pos(${vars}), value)`,
      `}`,
    ]);
  }

  return addToSection(yul, section, [
    `function ${name}Storage() -> ${initial} {`,
    `${initial} := sload(${name}Pos())`,
    `}`,
    `function ${name}Set(value) {`,
    `sstore(${name}Pos(), value)`,
    `}`,
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
      ? `sstore(${index}, add(${expression}, ${(expression.length - 2) * 2}))`
      : `sstore(${index}, ${expression})`,
  ]);
};

const getParameters = (
  parameters: SkittlesParameter[],
  className: string
): string[] => {
  return [
    `let programSize := datasize("${className}")`,
    `let argSize := sub(codesize(), programSize)`,
    `codecopy(0, programSize, argSize)`,
    ...parameters.map(
      (input: SkittlesParameter, index: number) =>
        `let ${input.name}Var := mload(${index * 32})`
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
    ...getBlockYul(statements),
  ]);
};

const addTabs = (yul: string[]) => {
  const tab = `    `;
  let indentation = 0;
  const yulWithTabs = [];
  for (const line of yul) {
    if (line === "}") indentation--;
    yulWithTabs.push(`${tab.repeat(indentation)}${line}`);
    if (line.slice(-1) === "{") indentation++;
  }
  return yulWithTabs;
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

  // Formatting
  yul = addTabs(yul);

  const output = yul.join("\n");
  return output;
};

export default getYul;
