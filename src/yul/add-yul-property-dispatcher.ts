import { YulSection } from "../data/yul-template";
import getSelector from "../helpers/selector-helper";
import { addToSection } from "../helpers/yul-helper";
import { SkittlesVariable } from "../types/skittles-class";
import { decoderFunctions, returnFunctions } from "./yul-constants";

const getMappingTypes = (type: string): string[] => {
  return type.split(/,|\(|\)/).filter((t) => t && t != "mapping");
};

const addPropertyDispatcher = (
  yul: string[],
  abi: any[],
  property: SkittlesVariable
): string[] => {
  if (property.private) return yul;
  const { name, type } = property;
  const selector = getSelector(abi, name);

  if (type.includes("mapping")) {
    const types = getMappingTypes(type);
    const returnType = types[types.length - 1];
    return addToSection(yul, YulSection.Dispatchers, [
      `case ${selector} /* "${name}(${types.join(", ")})" */ {`,
      `${returnFunctions[returnType]}(${name}Storage(${types
        .splice(0, types.length - 1)
        .map((t, i) => `${decoderFunctions[t]}(${i})`)
        .join(", ")}))`,
      `}`,
    ]);
  }

  return addToSection(yul, YulSection.Dispatchers, [
    `case ${selector} /* "${name}()" */ {`,
    `${returnFunctions[type]}(${name}Storage())`,
    `}`,
  ]);
};

export default addPropertyDispatcher;
