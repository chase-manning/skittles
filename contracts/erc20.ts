import { address, msg } from "../src/types/core-types";

export class ERC20 {
  decimals: number;
  owner: address;

  totalSupply: number = 0;
  private _balances: Record<address, number>;

  constructor(decimals_: number) {
    this.decimals = decimals_;
    this.owner = msg.sender;
    this._balances[this.owner] = 100;
  }

  balanceOf(address: address): number {
    return this._balances[address];
  }

  transfer(to: address, amount: number): boolean {
    this._transfer(msg.sender, to, amount);
    return true;
  }

  private _transfer(from: address, to: address, amount: number): void {
    this._balances[to] += amount;
    this._balances[from] -= amount;
  }
}
