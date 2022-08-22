import { YulSection } from "../data/yul-template";
import { addToSection } from "../helpers/yul-helper";
import { SkittlesMethod, SkittlesParameter } from "../types/skittles-class";
import getBlockYul from "./get-block-yul";

const addMethodFunction = (yul: string[], method: SkittlesMethod) => {
  const { name, parameters, returns, statements } = method;
  const hasReturn = returns !== "void";
  return addToSection(yul, YulSection.Functions, [
    `function ${name}Function(${parameters
      .map((input: SkittlesParameter) => `${input.name}Var`)
      .join(", ")}) ${hasReturn ? `-> v ` : ""}{`,
    ...getBlockYul(statements),
    `}`,
  ]);
};

export default addMethodFunction;
