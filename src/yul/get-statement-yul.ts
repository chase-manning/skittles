import { SkittlesExpressionType } from "../types/skittles-expression";
import {
  SkittlesEmitEventStatement,
  SkittlesExpressionStatement,
  SkittlesIfStatement,
  SkittlesMappingUpdateStatement,
  SkittlesReturnStatement,
  SkittlesStatement,
  SkittlesStatementType,
  SkittlesStorageUpdateStatement,
  SkittlesThrowStatement,
  SkittlesVariableDeclarationStatement,
  SkittlesVariableUpdateStatement,
} from "../types/skittles-statement";
import getExpressionYul from "./get-expression-yul";

const getStorageUpdateYul = (statement: SkittlesStorageUpdateStatement): string[] => {
  const { variable, value } = statement;
  return [`${variable}Set(${getExpressionYul(value)})`];
};

const getReturnYul = (statement: SkittlesReturnStatement): string[] => {
  const { value } = statement;
  if (value.expressionType === SkittlesExpressionType.Interface) {
    return [
      ...value.interface.elements.map((e) => {
        return `_${e.name}Var := ${getExpressionYul(value.values[e.name])}`;
      }),
    ];
  }
  return [`v := ${getExpressionYul(value)}`];
};

const getMappingUpdateYul = (statement: SkittlesMappingUpdateStatement): string[] => {
  const { variable, items, value } = statement;
  const variables = items.map((item) => getExpressionYul(item));
  return [`${variable}Set(${variables.join(", ")}, ${getExpressionYul(value)})`];
};

const getExpressionStatementYul = (statement: SkittlesExpressionStatement): string[] => {
  const { expression } = statement;
  return [`${getExpressionYul(expression)}`];
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
    `switch ${getExpressionYul(condition)}`,
    `case true {`,
    ...statements,
    `}`,
    `case false {`,
    ...elseStatements,
    `}`,
  ];
};

const getThrowYul = (statement: SkittlesThrowStatement): string[] => {
  const { error } = statement;
  return [`revert256(${getExpressionYul(error)})`];
};

const getVariableDeclarationYul = (statement: SkittlesVariableDeclarationStatement): string[] => {
  const { variable, value } = statement;
  return [`let ${variable}Var := ${getExpressionYul(value)}`];
};

const getVariableUpdateYul = (statement: SkittlesVariableUpdateStatement): string[] => {
  const { variable, value } = statement;
  return [`${variable}Var := ${getExpressionYul(value)}`];
};

const getEmitEventYul = (statement: SkittlesEmitEventStatement): string[] => {
  const { event, values } = statement;
  return [`emit${event.label}Event(${values.map(getExpressionYul).join(", ")})`];
};

const getStatementYul = (statement: SkittlesStatement): string[] => {
  switch (statement.statementType) {
    case SkittlesStatementType.StorageUpdate:
      return getStorageUpdateYul(statement);
    case SkittlesStatementType.Return:
      return getReturnYul(statement);
    case SkittlesStatementType.MappingUpdate:
      return getMappingUpdateYul(statement);
    case SkittlesStatementType.Expression:
      return getExpressionStatementYul(statement);
    case SkittlesStatementType.If:
      return getIfYul(statement);
    case SkittlesStatementType.Throw:
      return getThrowYul(statement);
    case SkittlesStatementType.VariableDeclaration:
      return getVariableDeclarationYul(statement);
    case SkittlesStatementType.VariableUpdate:
      return getVariableUpdateYul(statement);
    case SkittlesStatementType.EmitEvent:
      return getEmitEventYul(statement);
    default:
      throw new Error(`Unsupported statement type ${statement.statementType}`);
  }
};

export default getStatementYul;
