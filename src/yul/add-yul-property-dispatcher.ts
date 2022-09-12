import { YulSection } from "../data/yul-template";
import { getFunctionSelector } from "../helpers/selector-helper";
import { addToSection } from "../helpers/yul-helper";
import { SkittlesVariable } from "../types/skittles-contract";
import { SkittlesTypeKind } from "../types/skittles-type";
import { decoderFunctions, returnFunctions } from "./yul-constants";

const addPropertyDispatcher = (
  yul: string[],
  abi: any[],
  property: SkittlesVariable
): string[] => {
  if (property.private) return yul;
  const { name, type } = property;
  const selector = getFunctionSelector(abi, name);

  // Handling Mappings
  if (type.kind === SkittlesTypeKind.Mapping) {
    const inputTypes = type.inputs.map((input) => {
      return input.kind;
    });
    return addToSection(yul, YulSection.Dispatchers, [
      `case ${selector} /* "${name}(${inputTypes.join(", ")})" */ {`,
      `${returnFunctions[type.output.kind]}(${name}Storage(${inputTypes
        .map((t, i) => `${decoderFunctions[t]}(${i})`)
        .join(", ")}))`,
      `}`,
    ]);
  }

  // Handling Arrays
  if (type.kind === SkittlesTypeKind.Array) {
    return addToSection(yul, YulSection.Dispatchers, [
      `case ${selector} /* "${name}(uint256)" */ {`,
      `${
        returnFunctions[type.itemType.kind]
      }(${name}IndexStorage(decodeAsUint(0)))`,
      `}`,
    ]);
  }

  // Handle normal variables
  return addToSection(yul, YulSection.Dispatchers, [
    `case ${selector} /* "${name}()" */ {`,
    `${returnFunctions[type.kind]}(${name}Storage())`,
    `}`,
  ]);
};

export default addPropertyDispatcher;
