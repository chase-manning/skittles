import { SkittlesStatement } from "./skittles-statement";

export enum SkittlesTypeKind {
  Mapping = "Mapping",
  Void = "Void",
  Interface = "Interface",
  String = "string",
  Address = "address",
  Number = "uint256",
  Boolean = "bool",
  Array = "array",
}

export interface SkittlesBaseType {
  kind: SkittlesTypeKind;
}

export interface SkittleSimpleType extends SkittlesBaseType {
  kind:
    | SkittlesTypeKind.String
    | SkittlesTypeKind.Address
    | SkittlesTypeKind.Boolean
    | SkittlesTypeKind.Void
    | SkittlesTypeKind.Number;
}

export interface SkittlesArrayType extends SkittlesBaseType {
  kind: SkittlesTypeKind.Array;
  itemType: SkittlesType;
}

export interface SkittlesInterfaceType extends SkittlesBaseType {
  kind: SkittlesTypeKind.Interface;
  interface: SkittlesInterface;
}

export interface SkittlesMappingType extends SkittlesBaseType {
  kind: SkittlesTypeKind.Mapping;
  inputs: SkittlesType[];
  output: SkittlesType;
}

export type SkittlesType =
  | SkittlesArrayType
  | SkittlesInterfaceType
  | SkittlesMappingType
  | SkittleSimpleType;

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
}

export interface SkittlesBaseExpression {
  expressionType: SkittlesExpressionType;
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
  | SkittlesStorageExpression;

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

interface SkittlesContract {
  classExtensions: string[];
  interfaces: SkittlesInterfaces;
  name: string;
  constructor?: SkittlesConstructor;
  variables: SkittlesVariable[];
  methods: SkittlesMethod[];
}

export default SkittlesContract;
