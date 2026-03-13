import { SkittlesError } from "skittles";

/**
 * Contract module that helps prevent reentrant calls to a function.
 * Based on OpenZeppelin Contracts v5.
 *
 * Skittles does not have Solidity-style modifiers. Instead, call
 * `this._nonReentrantBefore()` at the start of the function and
 * `this._nonReentrantAfter()` at the end.
 */
export class ReentrancyGuard {
  static readonly NOT_ENTERED: number = 1;
  static readonly ENTERED: number = 2;

  ReentrancyGuardReentrantCall: SkittlesError<{}>;

  private _status: number = ReentrancyGuard.NOT_ENTERED;

  protected _nonReentrantBefore(): void {
    if (this._status == ReentrancyGuard.ENTERED) {
      throw this.ReentrancyGuardReentrantCall();
    }
    this._status = ReentrancyGuard.ENTERED;
  }

  protected _nonReentrantAfter(): void {
    this._status = ReentrancyGuard.NOT_ENTERED;
  }

  protected _reentrancyGuardEntered(): boolean {
    return this._status == ReentrancyGuard.ENTERED;
  }
}
