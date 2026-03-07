import { address, msg, SkittlesEvent, SkittlesError, Indexed } from "skittles";
import { ERC20 } from "./ERC20.ts";

/**
 * Extension of ERC-20 to support token-based voting and delegation.
 * Based on OpenZeppelin Contracts v5 (simplified).
 *
 * Token holders can delegate their voting power to any address.
 * Voting power is tracked and updated automatically on transfers.
 *
 * Note: Users must delegate (even to themselves) to activate voting
 * power. Tokens held by accounts that have not delegated do not
 * count as votes.
 */
export class ERC20Votes extends ERC20 {
  DelegateChanged: SkittlesEvent<{
    delegator: Indexed<address>;
    fromDelegate: Indexed<address>;
    toDelegate: Indexed<address>;
  }>;
  DelegateVotesChanged: SkittlesEvent<{
    delegate: Indexed<address>;
    previousVotes: number;
    newVotes: number;
  }>;

  private _delegates: Record<address, address> = {};
  private _votingPower: Record<address, number> = {};

  constructor(name_: string, symbol_: string) {
    super(name_, symbol_);
  }

  public delegates(account: address): address {
    return this._delegates[account];
  }

  public getVotes(account: address): number {
    return this._votingPower[account];
  }

  public delegate(delegatee: address): void {
    this._delegate(msg.sender, delegatee);
  }

  protected _delegate(account: address, delegatee: address): void {
    let oldDelegate: address = this._delegates[account];
    this._delegates[account] = delegatee;
    this.DelegateChanged.emit(account, oldDelegate, delegatee);
    this._moveDelegateVotes(oldDelegate, delegatee, this.balanceOf(account));
  }

  protected _moveDelegateVotes(
    from: address,
    to: address,
    amount: number
  ): void {
    if (amount > 0) {
      if (from != "0x0000000000000000000000000000000000000000") {
        let oldValue: number = this._votingPower[from];
        let newValue: number = oldValue - amount;
        this._votingPower[from] = newValue;
        this.DelegateVotesChanged.emit(from, oldValue, newValue);
      }
      if (to != "0x0000000000000000000000000000000000000000") {
        let oldValue: number = this._votingPower[to];
        let newValue: number = oldValue + amount;
        this._votingPower[to] = newValue;
        this.DelegateVotesChanged.emit(to, oldValue, newValue);
      }
    }
  }

  protected override _update(
    from: address,
    to: address,
    value: number
  ): void {
    super._update(from, to, value);
    this._moveDelegateVotes(
      this._delegates[from],
      this._delegates[to],
      value
    );
  }
}
