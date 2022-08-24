import {
  SkittlesCallStatement,
  SkittlesExpressionType,
  SkittlesIfStatement,
  SkittlesMappingUpdateStatement,
  SkittlesReturnStatement,
  SkittlesStatement,
  SkittlesStatementType,
  SkittlesStorageUpdateStatement,
  SkittlesThrowStatement,
} from "../types/skittles-class";
import getExpressionYul from "./get-expression-yul";

const getStorageUpdateYul = (
  statement: SkittlesStorageUpdateStatement
): string[] => {
  const { variable, value } = statement;
  return [`${variable}Set(${getExpressionYul(value)})`];
};

const getReturnYul = (statement: SkittlesReturnStatement): string[] => {
  const { value } = statement;
  return [`v := ${getExpressionYul(value)}`];
};

const getMappingUpdateYul = (
  statement: SkittlesMappingUpdateStatement
): string[] => {
  const { variable, items, value } = statement;
  const variables = items.map((item) => getExpressionYul(item));
  return [
    `${variable}Set(${variables.join(", ")}, ${getExpressionYul(value)})`,
  ];
};

const getCallYul = (statement: SkittlesCallStatement): string[] => {
  const { target, parameters } = statement;
  return [`${target}Function(${parameters.map(getExpressionYul).join(", ")})`];
};

const getIfYul = (statement: SkittlesIfStatement): string[] => {
  const { condition, then } = statement;
  const statements = [];
  for (const statement of then) {
    statements.push(...getStatementYul(statement));
  }
  if (statement.else.length === 0) {
    return [`if ${getExpressionYul(condition)} {`, ...statements, `}`];
  }
  const elseStatements = [];
  for (const s of statement.else) {
    elseStatements.push(...getStatementYul(s));
  }
  return [
    `if ${getExpressionYul(condition)} {`,
    ...statements,
    `}`,
    `if ${getExpressionYul({
      expressionType: SkittlesExpressionType.Not,
      value: condition,
    })} {`,
    ...elseStatements,
    `}`,
  ];
};

const getThrowYul = (statement: SkittlesThrowStatement): string[] => {
  const { error } = statement;
  return [`revert256(${getExpressionYul(error)})`];
};

const getStatementYul = (statement: SkittlesStatement): string[] => {
  switch (statement.statementType) {
    case SkittlesStatementType.StorageUpdate:
      return getStorageUpdateYul(statement);
    case SkittlesStatementType.Return:
      return getReturnYul(statement);
    case SkittlesStatementType.MappingUpdate:
      return getMappingUpdateYul(statement);
    case SkittlesStatementType.Call:
      return getCallYul(statement);
    case SkittlesStatementType.If:
      return getIfYul(statement);
    case SkittlesStatementType.Throw:
      return getThrowYul(statement);
    default:
      throw new Error(`Unsupported statement type ${statement}`);
  }
};

export default getStatementYul;
