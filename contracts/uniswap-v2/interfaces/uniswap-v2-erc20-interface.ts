import { address } from "../../../src/types/core-types";

export interface IUniswapV2ERC20 {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: number;
  balanceOf: Record<address, number>;
  allowance: Record<address, Record<address, number>>;
  approve(spender: address, amount: number): boolean;
  transfer(to: address, amount: number): boolean;
  transferFrom(from: address, to: address, amount: number): boolean;
}
