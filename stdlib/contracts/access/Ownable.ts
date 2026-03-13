import { address, msg, SkittlesEvent, SkittlesError, Indexed } from "skittles";
import { ZERO_ADDRESS } from "../constants.ts";

/**
 * Contract module providing a basic access control mechanism where an
 * account (the owner) is granted exclusive access to specific functions.
 * Based on OpenZeppelin Contracts v5.
 *
 * The initial owner is set in the constructor. This can later be changed
 * with `transferOwnership` and `renounceOwnership`.
 *
 * Skittles does not have Solidity-style modifiers. Instead, call
 * `this._checkOwner()` at the start of any function that should be
 * restricted to the owner.
 */
export class Ownable {
  OwnershipTransferred: SkittlesEvent<{
    previousOwner: Indexed<address>;
    newOwner: Indexed<address>;
  }>;

  OwnableUnauthorizedAccount: SkittlesError<{ account: address }>;
  OwnableInvalidOwner: SkittlesError<{ owner: address }>;

  private _owner: address;

  constructor(initialOwner: address) {
    if (initialOwner == ZERO_ADDRESS) {
      throw this.OwnableInvalidOwner(
        ZERO_ADDRESS
      );
    }
    this._transferOwnership(initialOwner);
  }

  public owner(): address {
    return this._owner;
  }

  protected _checkOwner(): void {
    if (msg.sender != this._owner) {
      throw this.OwnableUnauthorizedAccount(msg.sender);
    }
  }

  public renounceOwnership(): void {
    this._checkOwner();
    this._transferOwnership(
      ZERO_ADDRESS
    );
  }

  public transferOwnership(newOwner: address): void {
    this._checkOwner();
    if (newOwner == ZERO_ADDRESS) {
      throw this.OwnableInvalidOwner(
        ZERO_ADDRESS
      );
    }
    this._transferOwnership(newOwner);
  }

  protected _transferOwnership(newOwner: address): void {
    let oldOwner: address = this._owner;
    this._owner = newOwner;
    this.OwnershipTransferred.emit(oldOwner, newOwner);
  }
}
