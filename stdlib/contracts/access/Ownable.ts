import { address, msg, SkittlesEvent, SkittlesError, Indexed } from "skittles";

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
    if (initialOwner == "0x0000000000000000000000000000000000000000") {
      throw this.OwnableInvalidOwner(
        "0x0000000000000000000000000000000000000000"
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
      "0x0000000000000000000000000000000000000000"
    );
  }

  public transferOwnership(newOwner: address): void {
    this._checkOwner();
    if (newOwner == "0x0000000000000000000000000000000000000000") {
      throw this.OwnableInvalidOwner(
        "0x0000000000000000000000000000000000000000"
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
