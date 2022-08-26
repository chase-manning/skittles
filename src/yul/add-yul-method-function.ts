import { YulSection } from "../data/yul-template";
import { addToSection } from "../helpers/yul-helper";
import {
  SkittlesMethod,
  SkittlesParameter,
  SkittlesTypeKind,
} from "../types/skittles-class";
import getBlockYul from "./get-block-yul";

const addMethodFunction = (yul: string[], method: SkittlesMethod) => {
  const { name, parameters, returns, statements } = method;

  const returnVariables = () => {
    if (returns.kind === SkittlesTypeKind.Void) return "";
    if (returns.kind === SkittlesTypeKind.Interface) {
      return `-> ${returns.interface.elements
        .map((e) => `_${e.name}Var`)
        .join(", ")} `;
    }
    if (returns.kind === SkittlesTypeKind.Simple) return "-> v ";
    throw new Error(`Missing support for returns kind ${returns.kind}`);
  };

  return addToSection(yul, YulSection.Functions, [
    `function ${name}Function(${parameters
      .map((input: SkittlesParameter) => `${input.name}Var`)
      .join(", ")}) ${returnVariables()}{`,
    ...getBlockYul(statements),
    `}`,
  ]);
};

export default addMethodFunction;
