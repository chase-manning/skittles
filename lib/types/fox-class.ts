export enum FoxExpressionType {
  Binary = "Binary",
  Value = "Value",
  Storage = "Storage",
}

export interface FoxBaseExpression {
  expressionType: FoxExpressionType;
}

export enum FoxOperator {
  Plus = "+",
  Minus = "-",
  Multiply = "*",
  Divide = "/",
  Modulo = "%",
  Equals = "==",
  NotEquals = "!=",
  GreaterThan = ">",
  LessThan = "<",
  GreaterThanOrEqual = ">=",
  LessThanOrEqual = "<=",
  And = "&&",
  Or = "||",
  Not = "!",
}

export interface FoxBinaryExpression extends FoxBaseExpression {
  expressionType: FoxExpressionType.Binary;
  left: FoxExpression;
  right: FoxExpression;
  operator: FoxOperator;
}

export interface FoxValueExpression extends FoxBaseExpression {
  expressionType: FoxExpressionType.Value;
  value: any;
}

export interface FoxStorageExpression extends FoxBaseExpression {
  expressionType: FoxExpressionType.Storage;
  variable: string;
}

export type FoxExpression =
  | FoxBinaryExpression
  | FoxValueExpression
  | FoxStorageExpression;

export enum FoxStatementType {
  StorageUpdate = "StorageUpdate",
  Return = "Return",
}

export interface FoxBaseStatement {
  statementType: FoxStatementType;
}

export interface FoxStorageUpdateStatement extends FoxBaseStatement {
  statementType: FoxStatementType.StorageUpdate;
  variable: string;
  value: FoxExpression;
}

export interface FoxReturnStatement extends FoxBaseStatement {
  statementType: FoxStatementType.Return;
  type: string;
  value: FoxExpression;
}

export type FoxStatement = FoxStorageUpdateStatement | FoxReturnStatement;

export interface FoxProperty {
  name: string;
  type: string;
  value?: FoxExpression;
  private: boolean;
}

export interface FoxParameter {
  name: string;
  type: string;
}

export interface FoxMethod {
  name: string;
  returns: string;
  private: boolean;
  view: boolean;
  parameters: FoxParameter[];
  statements: FoxStatement[];
}

interface FoxClass {
  name: string;
  properties: FoxProperty[];
  methods: FoxMethod[];
}

export default FoxClass;
