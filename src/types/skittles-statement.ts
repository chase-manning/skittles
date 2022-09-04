import { SkittlesType } from "./skittles-contract";
import { SkittlesExpression } from "./skittles-expression";

export enum SkittlesStatementType {
  StorageUpdate = "Storage Update",
  Return = "Return",
  MappingUpdate = "Mapping Update",
  VariableUpdate = "Variable Update",
  Call = "Call",
  If = "If",
  Throw = "Throw",
  Ignore = "Ignore",
  VariableDeclaration = "Variable Declaration",
}

export interface SkittlesBaseStatement {
  statementType: SkittlesStatementType;
}

export interface SkittlesVariableDeclarationStatement
  extends SkittlesBaseStatement {
  statementType: SkittlesStatementType.VariableDeclaration;
  variable: string;
  value: SkittlesExpression;
}

export interface SkittlesIgnoreStatement extends SkittlesBaseStatement {
  statementType: SkittlesStatementType.Ignore;
}

export interface SkittlesThrowStatement extends SkittlesBaseStatement {
  statementType: SkittlesStatementType.Throw;
  error: SkittlesExpression;
}

export interface SkittlesIfStatement extends SkittlesBaseStatement {
  statementType: SkittlesStatementType.If;
  condition: SkittlesExpression;
  then: SkittlesStatement[];
  else: SkittlesStatement[];
}

export interface SkittlesCallStatement extends SkittlesBaseStatement {
  statementType: SkittlesStatementType.Call;
  target: string;
  element: SkittlesExpression;
  parameters: SkittlesExpression[];
}

export interface SkittlesMappingUpdateStatement extends SkittlesBaseStatement {
  statementType: SkittlesStatementType.MappingUpdate;
  variable: string;
  items: SkittlesExpression[];
  value: SkittlesExpression;
}

export interface SkittlesVariableUpdateStatement extends SkittlesBaseStatement {
  statementType: SkittlesStatementType.VariableUpdate;
  variable: string;
  value: SkittlesExpression;
}

export interface SkittlesStorageUpdateStatement extends SkittlesBaseStatement {
  statementType: SkittlesStatementType.StorageUpdate;
  variable: string;
  value: SkittlesExpression;
}

export interface SkittlesReturnStatement extends SkittlesBaseStatement {
  statementType: SkittlesStatementType.Return;
  type: SkittlesType;
  value: SkittlesExpression;
}

export type SkittlesStatement =
  | SkittlesVariableUpdateStatement
  | SkittlesVariableDeclarationStatement
  | SkittlesIgnoreStatement
  | SkittlesThrowStatement
  | SkittlesIfStatement
  | SkittlesCallStatement
  | SkittlesMappingUpdateStatement
  | SkittlesStorageUpdateStatement
  | SkittlesReturnStatement;
