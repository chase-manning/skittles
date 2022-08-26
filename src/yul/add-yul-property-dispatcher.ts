import { YulSection } from "../data/yul-template";
import getSelector from "../helpers/selector-helper";
import { addToSection } from "../helpers/yul-helper";
import { SkittlesTypeKind, SkittlesVariable } from "../types/skittles-class";
import { decoderFunctions, returnFunctions } from "./yul-constants";

const addPropertyDispatcher = (
  yul: string[],
  abi: any[],
  property: SkittlesVariable
): string[] => {
  if (property.private) return yul;
  const { name, type } = property;
  const selector = getSelector(abi, name);

  if (type.kind === SkittlesTypeKind.Mapping) {
    if (type.output.kind !== SkittlesTypeKind.Simple) {
      throw new Error("Unexpected type kind 2");
    }
    const inputTypes = type.inputs.map((input) => {
      if (input.kind !== SkittlesTypeKind.Simple) {
        throw new Error("Unexpected type kind 3");
      }
      return input.value;
    });
    return addToSection(yul, YulSection.Dispatchers, [
      `case ${selector} /* "${name}(${inputTypes.join(", ")})" */ {`,
      `${returnFunctions[type.output.value]}(${name}Storage(${inputTypes
        .map((t, i) => `${decoderFunctions[t]}(${i})`)
        .join(", ")}))`,
      `}`,
    ]);
  }

  if (type.kind !== SkittlesTypeKind.Simple) {
    throw new Error("Unexpected type kind 4");
  }

  return addToSection(yul, YulSection.Dispatchers, [
    `case ${selector} /* "${name}()" */ {`,
    `${returnFunctions[type.value]}(${name}Storage())`,
    `}`,
  ]);
};

export default addPropertyDispatcher;
