import { address } from "skittles";

export default interface IToken {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: number;
  balanceOf(account: address): number;
  transfer(to: address, amount: number): boolean;
  approve(spender: address, amount: number): boolean;
  transferFrom(from: address, to: address, amount: number): boolean;
  allowance(owner: address, spender: address): number;
}
