import { ZERO_ADDRESS } from "../../src/data/constants";
import { address, msg, SkittlesEvent } from "../../src/types/core-types";
import IUniswapV2ERC20, {
  ApprovalEvent,
  TransferEvent,
} from "./interfaces/uniswap-v2-erc20-interface";

class UniswapV2ERC20 implements IUniswapV2ERC20 {
  readonly name: string = "Uniswap V2";
  readonly symbol: string = "UNI-V2";
  readonly decimals: number = 18;
  totalSupply: number;
  balanceOf: Record<address, number>;
  allowance: Record<address, Record<address, number>>;

  Approval: SkittlesEvent<ApprovalEvent>;
  Transfer: SkittlesEvent<TransferEvent>;

  protected _mint(to: address, amount: number): void {
    this.balanceOf[to] += amount;
    this.totalSupply += amount;
    this.Transfer.emit({ from: ZERO_ADDRESS, to, value: amount });
  }

  protected _burn(from: address, amount: number): void {
    this.balanceOf[from] -= amount;
    this.totalSupply -= amount;
    this.Transfer.emit({ from, to: ZERO_ADDRESS, value: amount });
  }

  private _approve(from: address, to: address, amount: number): void {
    this.allowance[from][to] = amount;
    this.Approval.emit({ owner: from, spender: to, value: amount });
  }

  private _transfer(from: address, to: address, amount: number): void {
    this.balanceOf[to] += amount;
    this.balanceOf[from] -= amount;
    this.Transfer.emit({ from, to, value: amount });
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

export default UniswapV2ERC20;
