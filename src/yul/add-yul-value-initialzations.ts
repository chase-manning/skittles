import { YulSection } from "../data/yul-template";
import { addToSection } from "../helpers/yul-helper";
import { SkittlesTypeKind, SkittlesVariable } from "../types/skittles-class";
import getExpressionYul from "./get-expression-yul";

const addValueInitializations = (
  yul: string[],
  property: SkittlesVariable,
  index: number
) => {
  if (!property.value) return yul;
  const expression = getExpressionYul(property.value);
  return addToSection(yul, YulSection.Constructor, [
    property.type.kind === SkittlesTypeKind.Simple &&
    property.type.value === "string"
      ? `sstore(${index}, add(${expression}, ${(expression.length - 2) * 2}))`
      : `sstore(${index}, ${expression})`,
  ]);
};

export default addValueInitializations;
