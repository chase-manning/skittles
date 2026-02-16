export interface AbiEventInput {
    indexed: boolean;
    name: string;
    type: string;
}
export interface AbiEvent {
    anonymous: boolean;
    inputs: AbiEventInput[];
    name: string;
    type: "event";
}
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
export declare type Abi = (AbiFunction | AbiEvent)[];
