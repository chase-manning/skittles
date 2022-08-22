import { YulSection } from "../data/yul-template";
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
import formatYul from "./format-yul";
import { addToSection, getBaseYul } from "../helpers/yul-helper";
import addStorageLayout from "./add-yul-storage-layout";
import getBlockYul from "./get-block-yul";
import addConstructor from "./add-yul-constructor";

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

const getYul = (skittlesClass: SkittlesClass, abi: Abi) => {
  // Getting base data
  let yul = getBaseYul(skittlesClass.name);

  // Adding properties
  skittlesClass.variables.forEach(
    (property: SkittlesVariable, index: number) => {
      yul = addPropertyDispatcher(yul, abi, property);
      yul = addStorageLayout(yul, property, index);
      yul = addStorageLayout(yul, property, index, true);
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
  return formatYul(yul);
};

export default getYul;
