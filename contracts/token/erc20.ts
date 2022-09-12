import { address, msg } from "../../src/types/core-types";
import { IERC20 } from "./ierc20";

// TODO Move events to interrace

// interface TransferEvent {
//   from: address;
//   to: address;
//   amount: number;
// }

// interface ApprovalEvent {
//   owner: address;
//   spender: address;
//   amount: number;
// }

// export class ERC20 implements IERC20 {
export class ERC20 implements IERC20 {
  readonly decimals: number = 18;
  readonly symbol: string = "TEST";
  readonly name: string = "TEST ERC20";

  totalSupply: number;
  balanceOf: Record<address, number>;
  allowance: Record<address, Record<address, number>>;

  // transferEvent: SkittlesEvent<TransferEvent>;
  // approvalEvent: SkittlesEvent<ApprovalEvent>;

  constructor(mintAmount_: number) {
    this.balanceOf[msg.sender] = mintAmount_;
    this.totalSupply = mintAmount_;
  }

  approve(spender: address, amount: number): boolean {
    this.allowance[msg.sender][spender] = amount;
    // this.approvalEvent.emit({ owner: msg.sender, spender, amount });
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
    // this.transferEvent.emit({ from, to, amount });
  }
}
