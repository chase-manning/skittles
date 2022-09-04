import { YulSection } from "../data/yul-template";
import { getVariables } from "../helpers/string-helper";
import { addToSection } from "../helpers/yul-helper";
import SkittlesClass, {
  SkittlesExpressionType,
  SkittlesStatement,
  SkittlesStatementType,
  SkittlesTypeKind,
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
  const initial = `_${name.substring(0, 1)}`;

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
    if (
      type.kind === SkittlesTypeKind.String &&
      value.expressionType === SkittlesExpressionType.Value
    ) {
      const expression = getExpressionYul(value);
      return addToSection(yul, section, [
        `function ${name}Storage() -> ${initial} {`,
        `${initial} := add(${expression}, ${(expression.length - 2) * 2})`,
        `}`,
      ]);
    }
    return addToSection(yul, section, [
      `function ${name}Storage() -> ${initial} {`,
      `${initial} := ${getExpressionYul(value)}`,
      `}`,
    ]);
  }

  if (type.kind === SkittlesTypeKind.Mapping) {
    const vars = getVariables(type.inputs.length);
    return addToSection(yul, section, [
      `function ${name}Storage(${vars}) -> ${initial} {`,
      `${initial} := sload(${name}Pos(${vars}))`,
      `}`,
      `function ${name}Set(${vars}, value) {`,
      `sstore(${name}Pos(${vars}), value)`,
      `}`,
    ]);
  }

  if (type.kind === SkittlesTypeKind.Array) {
    return addToSection(yul, section, [
      `function ${name}LengthStorage() -> ${initial} {`,
      `${initial} := sload(${name}LengthPos())`,
      `}`,
      `function ${name}IndexStorage(value) -> ${initial} {`,
      `if gte(value, ${name}LengthStorage()) { revert(0, 0) }`,
      `${initial} := sload(add(${name}ArrayPos(), value))`,
      `}`,
      `function ${name}Storage() -> l {`,
      `l := ${name}LengthStorage()`,
      `for { let j := 0} lt(j, l) { j := add(j, 1) } { mstore(j, ${name}IndexStorage(j)) }`,
      `}`,
      `function ${name}Push(value) {`,
      `let length := ${name}LengthStorage()`,
      `if gt(length, 18446744073709551614) { revert(0, 0) }`,
      `sstore(add(length, ${name}ArrayPos()), value)`,
      `sstore(${name}LengthPos(), add(length, 1))`,
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
