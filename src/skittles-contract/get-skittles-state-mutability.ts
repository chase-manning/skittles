import SkittlesContract, {
  SkittlesMethod,
  SkittlesStatementType,
  SkittlesTypeKind,
} from "../types/skittles-contract";

const getMethod = (
  target: string,
  contract: SkittlesContract
): SkittlesMethod => {
  const method = contract.methods.find((m) => m.name === target);
  if (!method) throw new Error(`Method ${target} not found`);
  return method;
};

const methodModifiesState = (
  method: SkittlesMethod,
  contract: SkittlesContract
): boolean => {
  if (method.returns.kind === SkittlesTypeKind.Void) return true;
  for (const statement of method.statements) {
    const { statementType } = statement;
    if (statementType === SkittlesStatementType.MappingUpdate) return true;
    if (statementType === SkittlesStatementType.StorageUpdate) return true;
    if (statementType === SkittlesStatementType.Call) {
      const target = getMethod(statement.target, contract);
      if (methodModifiesState(target, contract)) return true;
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
