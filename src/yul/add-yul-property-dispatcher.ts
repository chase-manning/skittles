import { YulSection } from "../data/yul-template";
import getSelector from "../helpers/selector-helper";
import { addToSection } from "../helpers/yul-helper";
import { SkittlesVariable } from "../types/skittles-class";
import { returnFunctions } from "./yul-constants";

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

export default addPropertyDispatcher;
