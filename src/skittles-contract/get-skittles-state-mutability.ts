import SkittlesContract, { SkittlesMethod } from "../types/skittles-contract";
import { SkittlesTypeKind } from "../types/skittles-type";
import { SkittlesStatementType } from "../types/skittles-statement";
import { SkittlesExpressionType } from "../types/skittles-expression";

const getMethod = (target: string, contract: SkittlesContract): SkittlesMethod => {
  const method = contract.methods.find((m) => m.name === target);
  if (!method) throw new Error(`Method ${target} not found`);
  return method;
};

const methodModifiesState = (method: SkittlesMethod, contract: SkittlesContract): boolean => {
  if (method.returns.kind === SkittlesTypeKind.Void) return true;
  for (const statement of method.statements) {
    const { statementType } = statement;
    if (statementType === SkittlesStatementType.MappingUpdate) return true;
    if (statementType === SkittlesStatementType.StorageUpdate) return true;
    if (statementType === SkittlesStatementType.Expression) {
      const { expression } = statement;
      if (expression.expressionType === SkittlesExpressionType.Call) {
        const target = getMethod(expression.target, contract);
        if (methodModifiesState(target, contract)) return true;
      }
    }
  }
  return false;
};

const getStateMutability = (contract: SkittlesContract): SkittlesContract => {
  for (let method of contract.methods) {
    method.view = !methodModifiesState(method, contract);
  }
  return contract;
};

export default getStateMutability;
