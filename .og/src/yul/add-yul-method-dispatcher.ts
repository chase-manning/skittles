import { YulSection } from "../data/yul-template";
import { getFunctionSelector } from "../helpers/selector-helper";
import { addToSection } from "../helpers/yul-helper";
import { SkittlesMethod, SkittlesParameter } from "../types/skittles-contract";
import { SkittlesTypeKind } from "../types/skittles-type";
import { decoderFunctions, returnFunctions } from "./yul-constants";

const addMethodDispatcher = (yul: string[], abi: any[], method: SkittlesMethod): string[] => {
  if (method.private) return yul;
  const { name, parameters, returns } = method;
  const selector = getFunctionSelector(abi, name);

  if (returns.kind === SkittlesTypeKind.Mapping) {
    throw new Error("Unexpected type kind 5");
  }
  const functionInputs = parameters
    .map(
      (input: SkittlesParameter, index: number) => `${decoderFunctions[input.type.kind]}(${index})`
    )
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
    return [`${returnFunctions[returns.kind]}(${name}Function(${functionInputs}))`];
  };

  return addToSection(yul, YulSection.Dispatchers, [
    `case ${selector} /* "${name}(${parameters
      .map((p) => {
        return p.type.kind;
      })
      .join(", ")})" */ {`,
    ...functionCall(),
    `}`,
  ]);
};

export default addMethodDispatcher;
