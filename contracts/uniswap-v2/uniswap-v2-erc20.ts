import { address, msg } from "../../src/types/core-types";

// TODO Extend interface
// TODO Add events

export class UniswapV2ERC20 {
  readonly name: string = "Uniswap V2";
  readonly symbol: string = "UNI-V2";
  readonly decimals: number = 18;
  totalSupply: number;
  balanceOf: Record<address, number>;
  allowance: Record<address, Record<address, number>>;

  protected _mint(to: address, amount: number): void {
    this.balanceOf[to] += amount;
    this.totalSupply += amount;
  }

  protected _burn(from: address, amount: number): void {
    this.balanceOf[from] -= amount;
    this.totalSupply -= amount;
  }

  private _approve(from: address, to: address, amount: number): void {
    this.allowance[from][to] = amount;
  }

  private _transfer(from: address, to: address, amount: number): void {
    this.balanceOf[to] += amount;
    this.balanceOf[from] -= amount;
  }

  approve(spender: address, amount: number): boolean {
    this._approve(msg.sender, spender, amount);
    return true;
  }

  transfer(to: address, amount: number): boolean {
    this._transfer(msg.sender, to, amount);
    return true;
  }

  transferFrom(from: address, to: address, amount: number): boolean {
    if (this.allowance[from][msg.sender] !== Number.MAX_VALUE) {
      this.allowance[from][msg.sender] -= amount;
    }
    this._transfer(from, to, amount);
    return true;
  }
}
