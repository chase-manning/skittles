import { YulSection } from "../data/yul-template";
import { addToSection } from "../helpers/yul-helper";
import SkittlesContract, {
  SkittlesParameter,
  SkittlesVariable,
} from "../types/skittles-contract";
import {
  SkittlesStatement,
  SkittlesStatementType,
} from "../types/skittles-statement";
import getBlockYul from "./get-block-yul";

const getParameters = (
  parameters: SkittlesParameter[],
  className: string
): string[] => {
  return [
    `let programSize := datasize("${className}")`,
    `let argSize := sub(codesize(), programSize)`,
    `codecopy(0, programSize, argSize)`,
    ...parameters.map(
      (input: SkittlesParameter, index: number) =>
        `let ${input.name}Var := mload(${index * 32})`
    ),
  ];
};

const addConstructor = (yul: string[], contract: SkittlesContract) => {
  const { constructor } = contract;
  if (!constructor) return yul;
  let { parameters, statements } = constructor;
  parameters = parameters || [];
  statements = statements || [];

  statements = statements.filter((statement: SkittlesStatement) => {
    const { statementType } = statement;
    if (statementType !== SkittlesStatementType.StorageUpdate) return true;
    const variable = contract.variables.find(
      (v: SkittlesVariable) => v.name === statement.variable
    );
    if (!variable)
      throw new Error(`No variable found for ${statement.variable}`);
    return !variable.immutable;
  });
  return addToSection(yul, YulSection.Constructor, [
    ...getParameters(parameters, contract.name),
    ...getBlockYul(statements),
  ]);
};

export default addConstructor;
