import { address, msg } from "../src/types/core-types";

export class ERC20 {
  readonly decimals: number = 18;
  readonly symbol: string = "TEST";
  readonly name: string = "TEST ERC20";

  totalSupply: number;
  balanceOf: Record<address, number>;
  allowance: Record<address, Record<address, number>>;

  constructor(mintAmount_: number) {
    this.balanceOf[msg.sender] = mintAmount_;
    this.totalSupply = mintAmount_;
  }

  approve(spender: address, amount: number): boolean {
    this.allowance[msg.sender][spender] = amount;
    return true;
  }

  transfer(to: address, amount: number): boolean {
    this._transfer(msg.sender, to, amount);
    return true;
  }

  transferFrom(from: address, to: address, amount: number): boolean {
    if (this.allowance[from][msg.sender] < amount) {
      throw new Error("amount exceeds allowance");
    }
    this._transfer(from, to, amount);
    this.allowance[from][msg.sender] -= amount;
    return true;
  }

  private _transfer(from: address, to: address, amount: number): void {
    if (this.balanceOf[from] < amount) {
      throw new Error("transfer amount exceeds balance");
    }
    this.balanceOf[to] += amount;
    this.balanceOf[from] -= amount;
  }
}
