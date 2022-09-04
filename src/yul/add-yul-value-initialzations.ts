import { YulSection } from "../data/yul-template";
import { addToSection } from "../helpers/yul-helper";
import { SkittlesTypeKind, SkittlesVariable } from "../types/skittles-contract";
import getExpressionYul from "./get-expression-yul";

const addValueInitializations = (
  yul: string[],
  property: SkittlesVariable,
  index: number
) => {
  if (!property.value || property.immutable) return yul;
  const expression = getExpressionYul(property.value);
  return addToSection(yul, YulSection.Constructor, [
    property.type.kind === SkittlesTypeKind.String
      ? `sstore(${index}, add(${expression}, ${(expression.length - 2) * 2}))`
      : `sstore(${index}, ${expression})`,
  ]);
};

export default addValueInitializations;
