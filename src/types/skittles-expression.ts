import { SkittlesInterface } from "./skittles-contract";
import { SkittlesType } from "./skittles-type";

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

export enum SkittlesExpressionType {
  Not = "Not",
  Binary = "Binary",
  Value = "Value",
  Storage = "Storage",
  Variable = "Variable",
  Mapping = "Mapping",
  EvmDialect = "Evm Dialect",
  Interface = "Interface",
  Length = "Length",
  This = "This",
  Deploy = "Deploy",
  Conditional = "Conditional",
}

export interface SkittlesBaseExpression {
  expressionType: SkittlesExpressionType;
}

export interface SkittlesConditionalExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.Conditional;
  condition: SkittlesExpression;
  trueValue: SkittlesExpression;
  falseValue: SkittlesExpression;
}

export interface SkittlesDeployExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.Deploy;
  contract: string;
  parameters: SkittlesExpression[];
}

export interface SkittlesThisExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.This;
}

export interface SkittlesLengthExpression extends SkittlesBaseExpression {
  expressionType: SkittlesExpressionType.Length;
  value: SkittlesExpression;
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
  | SkittlesDeployExpression
  | SkittlesThisExpression
  | SkittlesLengthExpression
  | SkittlesInterfaceExpression
  | SkittlesNotExpression
  | SkittlesEvmDialectExpression
  | SkittlesMappingExpression
  | SkittlesBinaryExpression
  | SkittlesVariableExpression
  | SkittlesValueExpression
  | SkittlesStorageExpression
  | SkittlesConditionalExpression;
