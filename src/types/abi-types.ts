export interface AbiParameter {
  name: string;
  type: string;
}

export interface AbiFunction {
  type: "function" | "constructor" | "receive" | "fallback";
  name?: string;
  inputs: AbiParameter[];
  outputs?: AbiParameter[];
  stateMutability: "view" | "payable" | "nonpayable" | "pure";
}

export type Abi = AbiFunction[];
