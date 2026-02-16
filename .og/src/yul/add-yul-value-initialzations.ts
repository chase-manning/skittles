import { YulSection } from "../data/yul-template";
import { addToSection } from "../helpers/yul-helper";
import { SkittlesVariable } from "../types/skittles-contract";
import { SkittlesTypeKind } from "../types/skittles-type";
import getExpressionYul from "./get-expression-yul";

const addValueInitializations = (yul: string[], property: SkittlesVariable, index: number) => {
  if (!property.value || property.immutable) return yul;
  const expression = getExpressionYul(property.value);
  return addToSection(yul, YulSection.Constructor, [`sstore(${index}, ${expression})`]);
};

export default addValueInitializations;
