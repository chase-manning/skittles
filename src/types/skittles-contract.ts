import { SkittlesExpression } from "./skittles-expression";
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
