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
  ReentrancyGuardReentrantCall: SkittlesError<{}>;

  private _status: number = 1;

  protected _nonReentrantBefore(): void {
    if (this._status == 2) {
      throw this.ReentrancyGuardReentrantCall();
    }
    this._status = 2;
  }

  protected _nonReentrantAfter(): void {
    this._status = 1;
  }

  protected _reentrancyGuardEntered(): boolean {
    return this._status == 2;
  }
}
