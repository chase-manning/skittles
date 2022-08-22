import { YulSection } from "../data/yul-template";
import { getVariables, subStringCount } from "../helpers/string-helper";
import { addToSection } from "../helpers/yul-helper";
import SkittlesClass, {
  SkittlesExpressionType,
  SkittlesStatement,
  SkittlesStatementType,
  SkittlesVariable,
} from "../types/skittles-class";
import getExpressionYul from "./get-expression-yul";

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

const addStorageAccess = (
  yul: string[],
  property: SkittlesVariable,
  skittlesClass: SkittlesClass,
  isConstructor?: boolean
) => {
  return _addStorageAccess(
    yul,
    property,
    isConstructor
      ? YulSection.ConstructorStorageAccess
      : YulSection.StorageAccess,
    skittlesClass
  );
};

export default addStorageAccess;
