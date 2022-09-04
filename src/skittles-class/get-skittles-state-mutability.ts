import SkittlesContract, {
  SkittlesMethod,
  SkittlesStatementType,
  SkittlesTypeKind,
} from "../types/skittles-class";

const getMethod = (
  target: string,
  skittlesClass: SkittlesContract
): SkittlesMethod => {
  const method = skittlesClass.methods.find((m) => m.name === target);
  if (!method) throw new Error(`Method ${target} not found`);
  return method;
};

const methodModifiesState = (
  method: SkittlesMethod,
  skittlesClass: SkittlesContract
): boolean => {
  if (method.returns.kind === SkittlesTypeKind.Void) return true;
  for (const statement of method.statements) {
    const { statementType } = statement;
    if (statementType === SkittlesStatementType.MappingUpdate) return true;
    if (statementType === SkittlesStatementType.StorageUpdate) return true;
    if (statementType === SkittlesStatementType.Call) {
      const target = getMethod(statement.target, skittlesClass);
      if (methodModifiesState(target, skittlesClass)) return true;
    }
  }
  return false;
};

const getStateMutability = (
  skittlesClass: SkittlesContract
): SkittlesContract => {
  for (let method of skittlesClass.methods) {
    method.view = !methodModifiesState(method, skittlesClass);
  }
  return skittlesClass;
};

export default getStateMutability;
