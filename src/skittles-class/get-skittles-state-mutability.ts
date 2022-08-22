import SkittlesClass, {
  SkittlesMethod,
  SkittlesStatementType,
} from "../types/skittles-class";

const getMethod = (
  target: string,
  skittlesClass: SkittlesClass
): SkittlesMethod => {
  const method = skittlesClass.methods.find((m) => m.name === target);
  if (!method) throw new Error(`Method ${target} not found`);
  return method;
};

const methodModifiesState = (
  method: SkittlesMethod,
  skittlesClass: SkittlesClass
): boolean => {
  if (method.returns === "void") return true;
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

const getStateMutability = (skittlesClass: SkittlesClass): SkittlesClass => {
  for (let method of skittlesClass.methods) {
    method.view = !methodModifiesState(method, skittlesClass);
  }
  return skittlesClass;
};

export default getStateMutability;
