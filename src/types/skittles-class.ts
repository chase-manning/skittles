export enum SkittlesExpressionType {
  Not = "Not",
  Binary = "Binary",
  Value = "Value",
  Storage = "Storage",
  Variable = "Variable",
  Mapping = "Mapping",
  EvmDialect = "Evm Dialect",
  Interface = "Interface",
}

export interface SkittlesBaseExpression {
  expressionType: SkittlesExpressionType;
}

export enum SkittlesTypeKind {
  Simple = "Simple",
  Mapping = "Mapping",
  Void = "Void",
  Interface = "Interface",
}

export interface SkittlesBaseType {
  kind: SkittlesTypeKind;
}

export interface SkittlesInterfaceType extends SkittlesBaseType {
  kind: SkittlesTypeKind.Interface;
  interface: SkittlesInterface;
}

export interface SkittlesVoidType extends SkittlesBaseType {
  kind: SkittlesTypeKind.Void;
}

export interface SkittlesSimpleType extends SkittlesBaseType {
  kind: SkittlesTypeKind.Simple;
  value: string;
}

export interface SkittlesMappingType extends SkittlesBaseType {
  kind: SkittlesTypeKind.Mapping;
  inputs: SkittlesType[];
  output: SkittlesType;
}

export type SkittlesType =
  | SkittlesInterfaceType
  | SkittlesSimpleType
  | SkittlesMappingType
  | SkittlesVoidType;

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
  Power,
}

export interface SkittlesInterfaceExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.Interface;
  interface: SkittlesInterface;
  values: Record<string, SkittlesExpression>;
}

export interface SkittlesNotExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.Not;
  value: SkittlesExpression;
}

export interface SkittlesEvmDialectExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.EvmDialect;
  environment: string;
  variable: string;
}

export interface SkittlesMappingExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.Mapping;
  variable: string;
  items: SkittlesExpression[];
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
  type: SkittlesType;
  value: any;
}

export interface SkittlesStorageExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.Storage;
  variable: string;
}

export type SkittlesExpression =
  | SkittlesInterfaceExpression
  | SkittlesNotExpression
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
  Throw = "Throw",
}

export interface SkittlesBaseStatement {
  statementType: SkittlesStatementType;
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
  parameters: SkittlesExpression[];
}

export interface SkittlesMappingUpdateStatement extends SkittlesBaseStatement {
  statementType: SkittlesStatementType.MappingUpdate;
  variable: string;
  items: SkittlesExpression[];
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
  | SkittlesThrowStatement
  | SkittlesIfStatement
  | SkittlesCallStatement
  | SkittlesMappingUpdateStatement
  | SkittlesStorageUpdateStatement
  | SkittlesReturnStatement;

export interface SkittlesVariable {
  name: string;
  type: SkittlesType;
  value?: SkittlesExpression;
  private: boolean;
  immutable: boolean;
}

export interface SkittlesParameter {
  name: string;
  type: SkittlesType;
}

export interface SkittlesMethod {
  name: string;
  returns: SkittlesType;
  private: boolean;
  view: boolean;
  parameters: SkittlesParameter[];
  statements: SkittlesStatement[];
}

export interface SkittlesConstructor {
  parameters: SkittlesParameter[];
  statements: SkittlesStatement[];
}

export interface SkittlesInterface {
  name: string;
  elements: SkittlesParameter[];
}

export type SkittlesInterfaces = Record<string, SkittlesInterface>;

interface SkittlesClass {
  interfaces: SkittlesInterfaces;
  name: string;
  constructor?: SkittlesConstructor;
  variables: SkittlesVariable[];
  methods: SkittlesMethod[];
}

export default SkittlesClass;
