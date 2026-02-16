import { address, SkittlesEvent } from "skittles/lib/types/core-types";
export interface TransferEvent {
    from: address;
    to: address;
    amount: number;
}
export interface ApprovalEvent {
    owner: address;
    spender: address;
    amount: number;
}
/**
 * A simple ERC20 token implementation in Skittles.
 * This demonstrates a more complex contract with events and mappings.
 */
export declare class ERC20 {
    readonly decimals: number;
    readonly symbol: string;
    readonly name: string;
    totalSupply: number;
    balanceOf: Record<address, number>;
    allowance: Record<address, Record<address, number>>;
    Transfer: SkittlesEvent<TransferEvent>;
    Approval: SkittlesEvent<ApprovalEvent>;
    constructor(initialSupply: number);
    approve(spender: address, amount: number): boolean;
    transfer(to: address, amount: number): boolean;
    transferFrom(from: address, to: address, amount: number): boolean;
    private _transfer;
}
