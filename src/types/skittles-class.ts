export enum SkittlesExpressionType {
  Binary = "Binary",
  Value = "Value",
  Storage = "Storage",
  Variable = "Variable",
  Mapping = "Mapping",
  EvmDialect = "Evm Dialect",
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

export interface SkittlesEvmDialectExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.EvmDialect;
  environment: string;
  variable: string;
}

export interface SkittlesMappingExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.Mapping;
  variable: string;
  item: SkittlesExpression;
}

export interface SkittlesBinaryExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.Binary;
  left: SkittlesExpression;
  right: SkittlesExpression;
  operator: SkittlesOperator;
}

export interface SkittlesVariableExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.Variable;
  value: any;
}

export interface SkittlesValueExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.Value;
  type: string;
  value: any;
}

export interface SkittlesStorageExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.Storage;
  variable: string;
}

export type SkittlesExpression =
  | SkittlesEvmDialectExpression
  | SkittlesMappingExpression
  | SkittlesBinaryExpression
  | SkittlesVariableExpression
  | SkittlesValueExpression
  | SkittlesStorageExpression;

export enum SkittlesStatementType {
  StorageUpdate = "Storage Update",
  Return = "Return",
  MappingUpdate = "Mapping Update",
  Call = "Call",
  If = "If",
}

export interface SkittlesBaseStatement {
  statementType: SkittlesStatementType;
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
  parameters: SkittlesExpression[];
}

export interface SkittlesMappingUpdateStatement extends SkittlesBaseStatement {
  statementType: SkittlesStatementType.MappingUpdate;
  variable: string;
  item: SkittlesExpression;
  value: SkittlesExpression;
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
  | SkittlesIfStatement
  | SkittlesCallStatement
  | SkittlesMappingUpdateStatement
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
