export enum SkittlesExpressionType {
  Binary = "Binary",
  Value = "Value",
  Storage = "Storage",
}

export interface SkittlesBaseExpression {
  expressionType: SkittlesExpressionType;
}

export enum SkittlesOperator {
  Plus,
  Minus,
  Multiply,
  Divide,
  Modulo,
  Equals,
  NotEquals,
  GreaterThan,
  LessThan,
  GreaterThanOrEqual,
  LessThanOrEqual,
  And,
  Or,
  Not,
}

export interface SkittlesBinaryExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.Binary;
  left: SkittlesExpression;
  right: SkittlesExpression;
  operator: SkittlesOperator;
}

export interface SkittlesValueExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.Value;
  value: any;
}

export interface SkittlesStorageExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.Storage;
  variable: string;
}

export type SkittlesExpression =
  | SkittlesBinaryExpression
  | SkittlesValueExpression
  | SkittlesStorageExpression;

export enum SkittlesStatementType {
  StorageUpdate = "StorageUpdate",
  Return = "Return",
}

export interface SkittlesBaseStatement {
  statementType: SkittlesStatementType;
}

export interface SkittlesStorageUpdateStatement extends SkittlesBaseStatement {
  statementType: SkittlesStatementType.StorageUpdate;
  variable: string;
  value: SkittlesExpression;
}

export interface SkittlesReturnStatement extends SkittlesBaseStatement {
  statementType: SkittlesStatementType.Return;
  type: string;
  value: SkittlesExpression;
}

export type SkittlesStatement =
  | SkittlesStorageUpdateStatement
  | SkittlesReturnStatement;

export interface SkittlesVariable {
  name: string;
  type: string;
  value?: SkittlesExpression;
  private: boolean;
}

export interface SkittlesParameter {
  name: string;
  type: string;
}

export interface SkittlesMethod {
  name: string;
  returns: string;
  private: boolean;
  view: boolean;
  parameters: SkittlesParameter[];
  statements: SkittlesStatement[];
}

export interface SkittlesConstructor {
  parameters: SkittlesParameter[];
  statements: SkittlesStatement[];
}

interface SkittlesClass {
  name: string;
  constructor?: SkittlesConstructor;
  variables: SkittlesVariable[];
  methods: SkittlesMethod[];
}

export default SkittlesClass;
