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

  if (returns.kind === SkittlesTypeKind.Mapping) {
    throw new Error("Unexpected type kind 5");
  }
  const functionInputs = parameters
    .map((input: SkittlesParameter, index: number) => {
      if (input.type.kind !== SkittlesTypeKind.Simple) {
        throw new Error("Unexpected type kind 6");
      }
      return `${decoderFunctions[input.type.value]}(${index})`;
    })
    .join(", ");

  const functionCall = (): string[] => {
    if (returns.kind === SkittlesTypeKind.Interface) {
      const { elements } = returns.interface;
      return [
        `let${elements
          .map((e) => ` _${e.name}Var`)
          .join(",")} := ${name}Function(${functionInputs})`,
        ...elements.map((e, index) => `mstore(${index * 32}, _${e.name}Var)`),
        `return(0, ${32 * elements.length})`,
      ];
    }
    if (returns.kind === SkittlesTypeKind.Void) {
      return [`${name}Function(${functionInputs})`];
    }
    if (returns.kind === SkittlesTypeKind.Simple) {
      return [
        `${returnFunctions[returns.value]}(${name}Function(${functionInputs}))`,
      ];
    }
    throw new Error("Unexpected type kind 7");
  };

  return addToSection(yul, YulSection.Dispatchers, [
    `case ${selector} /* "${name}(${parameters
      .map((p) => {
        if (p.type.kind !== SkittlesTypeKind.Simple) {
          throw new Error("Unexpected type kind 7");
        }
        return p.type.value;
      })
      .join(", ")})" */ {`,
    ...functionCall(),
    `}`,
  ]);
};

export default addMethodDispatcher;
