export interface AbiParameter {
  name: string;
  type: string; // TODO Add subtypes
}

export interface AbiFunction {
  type: "function" | "constructor" | "receive" | "fallback";
  name?: string;
  inputs: AbiParameter[];
  outputs?: AbiParameter[];
  stateMutability: "view" | "payable" | "nonpayable" | "pure";
}

export type Abi = AbiFunction[];
