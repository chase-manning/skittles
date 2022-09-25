import { address, msg, SkittlesContract, SkittlesEvent } from "../../src/types/core-types";
import IERC20, { ApprovalEvent, TransferEvent } from "./ierc20";

class ERC20 extends SkittlesContract implements IERC20 {
  readonly decimals: number = 18;
  readonly symbol: string = "TEST";
  readonly name: string = "TEST ERC20";

  totalSupply: number;
  balanceOf: Record<address, number>;
  allowance: Record<address, Record<address, number>>;

  Transfer: SkittlesEvent<TransferEvent>;
  Approval: SkittlesEvent<ApprovalEvent>;

  approve(spender: address, amount: number): boolean {
    this.allowance[msg.sender][spender] = amount;
    this.Approval.emit({ owner: msg.sender, spender, amount });
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

  private _transfer(from: address, to: address, amount: number): void {
    this.balanceOf[to] += amount;
    this.balanceOf[from] -= amount;
    this.Transfer.emit({ from, to, amount });
  }
}

export default ERC20;
