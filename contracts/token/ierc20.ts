import { address } from "../../src/types/core-types";

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

export default interface IERC20 {
  decimals: number;
  symbol: string;
  name: string;
  totalSupply: number;
  balanceOf: Record<address, number>;
  allowance: Record<address, Record<address, number>>;

  approve(spender: address, amount: number): boolean;
  transfer(to: address, amount: number): boolean;
  transferFrom(from: address, to: address, amount: number): boolean;
}
