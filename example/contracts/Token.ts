import {
  address,
  msg,
  SkittlesEvent,
  Indexed,
} from "skittles";

class InsufficientBalance extends Error {
  constructor(sender: address, balance: number, required: number) {
    super("");
  }
}

class InsufficientAllowance extends Error {
  constructor(spender: address, allowance: number, required: number) {
    super("");
  }
}

export class Token {
  Transfer: SkittlesEvent<{
    from: Indexed<address>;
    to: Indexed<address>;
    value: number;
  }>;
  Approval: SkittlesEvent<{
    owner: Indexed<address>;
    spender: Indexed<address>;
    value: number;
  }>;

  public name: string = "Skittles Token";
  public symbol: string = "SKT";
  public decimals: number = 18;
  public totalSupply: number = 0;

  private balances: Record<address, number> = {};
  private allowances: Record<address, Record<address, number>> = {};

  constructor(initialSupply: number) {
    this.totalSupply = initialSupply;
    this.balances[msg.sender] = initialSupply;
    this.Transfer.emit(
      "0x0000000000000000000000000000000000000000",
      msg.sender,
      initialSupply
    );
  }

  public balanceOf(account: address): number {
    return this.balances[account];
  }

  public allowance(owner: address, spender: address): number {
    return this.allowances[owner][spender];
  }

  public transfer(to: address, amount: number): boolean {
    this._transfer(msg.sender, to, amount);
    return true;
  }

  public approve(spender: address, amount: number): boolean {
    this._approve(msg.sender, spender, amount);
    return true;
  }

  public transferFrom(
    from: address,
    to: address,
    amount: number
  ): boolean {
    let currentAllowance: number = this.allowances[from][msg.sender];

    if (currentAllowance < amount) {
      throw new InsufficientAllowance(msg.sender, currentAllowance, amount);
    }

    if (currentAllowance != Number.MAX_VALUE) {
      this._approve(from, msg.sender, currentAllowance - amount);
    }

    this._transfer(from, to, amount);
    return true;
  }

  private _transfer(
    from: address,
    to: address,
    amount: number
  ): void {
    if (this.balances[from] < amount) {
      throw new InsufficientBalance(from, this.balances[from], amount);
    }
    this.balances[from] -= amount;
    this.balances[to] += amount;
    this.Transfer.emit(from, to, amount);
  }

  private _approve(
    owner: address,
    spender: address,
    amount: number
  ): void {
    this.allowances[owner][spender] = amount;
    this.Approval.emit(owner, spender, amount);
  }
}
