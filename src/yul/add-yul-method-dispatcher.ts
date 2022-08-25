import { YulSection } from "../data/yul-template";
import getSelector from "../helpers/selector-helper";
import { addToSection } from "../helpers/yul-helper";
import {
  SkittlesMethod,
  SkittlesParameter,
  SkittlesTypeKind,
} from "../types/skittles-class";
import { decoderFunctions, returnFunctions } from "./yul-constants";

const addMethodDispatcher = (
  yul: string[],
  abi: any[],
  method: SkittlesMethod
): string[] => {
  if (method.private) return yul;
  const { name, parameters, returns } = method;
  const selector = getSelector(abi, name);

  if (
    !(
      returns.kind === SkittlesTypeKind.Simple ||
      returns.kind === SkittlesTypeKind.Void
    )
  ) {
    throw new Error("Unexpected type kind");
  }
  const functionInputs = parameters
    .map((input: SkittlesParameter, index: number) => {
      if (input.type.kind !== SkittlesTypeKind.Simple) {
        throw new Error("Unexpected type kind");
      }
      return `${decoderFunctions[input.type.value]}(${index})`;
    })
    .join(", ");

  return addToSection(yul, YulSection.Dispatchers, [
    `case ${selector} /* "${name}(${parameters
      .map((p) => {
        if (p.type.kind !== SkittlesTypeKind.Simple) {
          throw new Error("Unexpected type kind");
        }
        return p.type.value;
      })
      .join(", ")})" */ {`,
    returns.kind === SkittlesTypeKind.Void
      ? `${name}Function(${functionInputs})`
      : `${returnFunctions[returns.value]}(${name}Function(${functionInputs}))`,
    `}`,
  ]);
};

export default addMethodDispatcher;
