import { SkittlesInterface } from "./skittles-contract";

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
