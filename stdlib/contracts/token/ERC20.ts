import { address, msg, SkittlesEvent, SkittlesError, Indexed } from "skittles";

/**
 * Implementation of the ERC-20 token standard.
 * Based on OpenZeppelin Contracts v5.
 *
 * Includes internal `_mint` and `_burn` functions that child contracts
 * can call, and a virtual `_update` hook for extensions.
 */
export class ERC20 {
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

  ERC20InsufficientBalance: SkittlesError<{
    sender: address;
    balance: number;
    needed: number;
  }>;
  ERC20InvalidSender: SkittlesError<{ sender: address }>;
  ERC20InvalidReceiver: SkittlesError<{ receiver: address }>;
  ERC20InsufficientAllowance: SkittlesError<{
    spender: address;
    allowance: number;
    needed: number;
  }>;
  ERC20InvalidApprover: SkittlesError<{ approver: address }>;
  ERC20InvalidSpender: SkittlesError<{ spender: address }>;

  private _name: string;
  private _symbol: string;
  private _totalSupply: number = 0;
  private _balances: Record<address, number> = {};
  private _allowances: Record<address, Record<address, number>> = {};

  constructor(name_: string, symbol_: string) {
    this._name = name_;
    this._symbol = symbol_;
  }

  public name(): string {
    return this._name;
  }

  public symbol(): string {
    return this._symbol;
  }

  public decimals(): number {
    return 18;
  }

  public totalSupply(): number {
    return this._totalSupply;
  }

  public balanceOf(account: address): number {
    return this._balances[account];
  }

  public transfer(to: address, value: number): boolean {
    this._transfer(msg.sender, to, value);
    return true;
  }

  public allowance(owner: address, spender: address): number {
    return this._allowances[owner][spender];
  }

  public approve(spender: address, value: number): boolean {
    this._approve(msg.sender, spender, value);
    return true;
  }

  public transferFrom(
    from: address,
    to: address,
    value: number
  ): boolean {
    this._spendAllowance(from, msg.sender, value);
    this._transfer(from, to, value);
    return true;
  }

  protected _transfer(
    from: address,
    to: address,
    value: number
  ): void {
    if (from == "0x0000000000000000000000000000000000000000") {
      throw this.ERC20InvalidSender(
        "0x0000000000000000000000000000000000000000"
      );
    }
    if (to == "0x0000000000000000000000000000000000000000") {
      throw this.ERC20InvalidReceiver(
        "0x0000000000000000000000000000000000000000"
      );
    }
    this._update(from, to, value);
  }

  protected _update(
    from: address,
    to: address,
    value: number
  ): void {
    if (from == "0x0000000000000000000000000000000000000000") {
      this._totalSupply += value;
    } else {
      if (this._balances[from] < value) {
        throw this.ERC20InsufficientBalance(
          from,
          this._balances[from],
          value
        );
      }
      this._balances[from] -= value;
    }

    if (to == "0x0000000000000000000000000000000000000000") {
      this._totalSupply -= value;
    } else {
      this._balances[to] += value;
    }

    this.Transfer.emit(from, to, value);
  }

  protected _mint(to: address, value: number): void {
    if (to == "0x0000000000000000000000000000000000000000") {
      throw this.ERC20InvalidReceiver(
        "0x0000000000000000000000000000000000000000"
      );
    }
    this._update("0x0000000000000000000000000000000000000000", to, value);
  }

  protected _burn(from: address, value: number): void {
    if (from == "0x0000000000000000000000000000000000000000") {
      throw this.ERC20InvalidSender(
        "0x0000000000000000000000000000000000000000"
      );
    }
    this._update(
      from,
      "0x0000000000000000000000000000000000000000",
      value
    );
  }

  protected _approve(
    owner: address,
    spender: address,
    value: number
  ): void {
    if (owner == "0x0000000000000000000000000000000000000000") {
      throw this.ERC20InvalidApprover(
        "0x0000000000000000000000000000000000000000"
      );
    }
    if (spender == "0x0000000000000000000000000000000000000000") {
      throw this.ERC20InvalidSpender(
        "0x0000000000000000000000000000000000000000"
      );
    }
    this._allowances[owner][spender] = value;
    this.Approval.emit(owner, spender, value);
  }

  protected _spendAllowance(
    owner: address,
    spender: address,
    value: number
  ): void {
    let currentAllowance: number = this.allowance(owner, spender);
    if (currentAllowance != Number.MAX_VALUE) {
      if (currentAllowance < value) {
        throw this.ERC20InsufficientAllowance(
          spender,
          currentAllowance,
          value
        );
      }
      this._approve(owner, spender, currentAllowance - value);
    }
  }
}
