import { address } from "../src/types/core-types";

export class ERC20 {
  decimals: number;
  owner: address;

  totalSupply: number = 0;
  private _balances: Record<address, number>;

  constructor(decimals_: number) {
    this.decimals = decimals_;
    this.owner = "0x00000000006c3852cbEf3e08E8dF289169EdE581";
    this._balances[this.owner] = 100;
  }

  balanceOf(address: address): number {
    return this._balances[address];
  }

  transfer(to: address, amount: number): boolean {
    this._balances[to] += amount;
    this._balances[this.owner] -= amount; // TODO Wrong
    return true;
  }
}
