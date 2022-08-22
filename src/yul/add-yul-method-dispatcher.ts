import { YulSection } from "../data/yul-template";
import getSelector from "../helpers/selector-helper";
import { addToSection } from "../helpers/yul-helper";
import { SkittlesMethod, SkittlesParameter } from "../types/skittles-class";
import { decoderFunctions, returnFunctions } from "./yul-constants";

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

export default addMethodDispatcher;
