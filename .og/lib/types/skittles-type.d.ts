import { SkittlesInterface } from "./skittles-contract";
export declare enum SkittlesTypeKind {
    Mapping = "Mapping",
    Void = "Void",
    Interface = "Interface",
    String = "string",
    Address = "address",
    Number = "uint256",
    Boolean = "bool",
    Array = "array",
    Bytes = "bytes32"
}
export interface SkittlesBaseType {
    kind: SkittlesTypeKind;
}
export interface SkittleSimpleType extends SkittlesBaseType {
    kind: SkittlesTypeKind.Bytes | SkittlesTypeKind.String | SkittlesTypeKind.Address | SkittlesTypeKind.Boolean | SkittlesTypeKind.Void | SkittlesTypeKind.Number;
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
export declare type SkittlesType = SkittlesArrayType | SkittlesInterfaceType | SkittlesMappingType | SkittleSimpleType;
