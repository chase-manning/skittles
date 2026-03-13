import { address, Indexed, msg, SkittlesEvent, SkittlesError } from "skittles";

/**
 * Contract module that allows children to implement an emergency stop
 * mechanism triggered by an authorized account.
 * Based on OpenZeppelin Contracts v5.
 *
 * Skittles does not have Solidity-style modifiers. Instead, call
 * `this._requireNotPaused()` or `this._requirePaused()` at the start
 * of functions that need the check.
 */
export class Pausable {
  Paused: SkittlesEvent<{ account: Indexed<address> }>;
  Unpaused: SkittlesEvent<{ account: Indexed<address> }>;

  EnforcedPause: SkittlesError<{}>;
  ExpectedPause: SkittlesError<{}>;

  private _paused: boolean = false;

  public paused(): boolean {
    return this._paused;
  }

  protected _requireNotPaused(): void {
    if (this._paused) {
      throw this.EnforcedPause();
    }
  }

  protected _requirePaused(): void {
    if (!this._paused) {
      throw this.ExpectedPause();
    }
  }

  protected _pause(): void {
    this._requireNotPaused();
    this._paused = true;
    this.Paused.emit(msg.sender);
  }

  protected _unpause(): void {
    this._requirePaused();
    this._paused = false;
    this.Unpaused.emit(msg.sender);
  }
}
