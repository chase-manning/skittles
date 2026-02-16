import {
  address,
  msg,
  block,
  SkittlesEvent,
  Indexed,
} from "skittles";

/**
 * NotOwner: reverted when a restricted function is called by a non-owner.
 */
class NotOwner extends Error {
  constructor(caller: address) {
    super("");
  }
}

/**
 * VaultPaused: reverted when the vault is paused and a deposit/withdraw is attempted.
 */
class VaultPaused extends Error {
  constructor() {
    super("");
  }
}

/**
 * InsufficientDeposit: reverted when a withdrawal exceeds the user's deposit.
 */
class InsufficientDeposit extends Error {
  constructor(account: address, deposited: number, requested: number) {
    super("");
  }
}

/**
 * Contract status: whether the vault is accepting deposits or not.
 */
enum VaultStatus {
  Active,
  Paused,
}

/**
 * A simple ETH staking vault written in Skittles TypeScript.
 *
 * Users deposit ETH and the vault tracks each account's balance.
 * The owner can pause/unpause the vault and withdraw fees.
 *
 * Features demonstrated:
 *   - Enums (VaultStatus)
 *   - Custom errors (NotOwner, VaultPaused, InsufficientDeposit)
 *   - receive() function for accepting plain ETH transfers
 *   - msg.value and msg.sender
 *   - block.timestamp for tracking deposit times
 *   - Constant state variables (static readonly)
 *   - Immutable state variables (readonly)
 *   - Private helper functions
 *   - Event emission with indexed parameters
 *   - Bitwise operators (for fee calculation)
 */
export class Staking {
  Deposited: SkittlesEvent<{
    account: Indexed<address>;
    amount: number;
    timestamp: number;
  }>;
  Withdrawn: SkittlesEvent<{
    account: Indexed<address>;
    amount: number;
  }>;
  StatusChanged: SkittlesEvent<{
    newStatus: number;
  }>;

  static readonly FEE_BASIS_POINTS: number = 50;
  static readonly BASIS_POINTS_DENOMINATOR: number = 10000;

  readonly owner: address = msg.sender;
  public status: VaultStatus;
  public totalDeposited: number = 0;
  public totalFees: number = 0;

  private deposits: Record<address, number> = {};
  private depositTimestamps: Record<address, number> = {};

  public receive(): void {
    this._deposit(msg.sender, msg.value);
  }

  public deposit(): void {
    if (msg.value == 0) {
      throw new Error("Must send ETH");
    }
    this._deposit(msg.sender, msg.value);
  }

  public withdraw(amount: number): void {
    this._requireActive();

    if (this.deposits[msg.sender] < amount) {
      throw new InsufficientDeposit(
        msg.sender,
        this.deposits[msg.sender],
        amount
      );
    }

    let fee: number = (amount * Staking.FEE_BASIS_POINTS) /
      Staking.BASIS_POINTS_DENOMINATOR;
    let payout: number = amount - fee;

    this.deposits[msg.sender] -= amount;
    this.totalDeposited -= amount;
    this.totalFees += fee;

    this.Withdrawn.emit(msg.sender, payout);
  }

  public getDeposit(account: address): number {
    return this.deposits[account];
  }

  public getDepositTimestamp(account: address): number {
    return this.depositTimestamps[account];
  }

  public pause(): void {
    this._requireOwner();
    this.status = VaultStatus.Paused;
    this.StatusChanged.emit(1);
  }

  public unpause(): void {
    this._requireOwner();
    this.status = VaultStatus.Active;
    this.StatusChanged.emit(0);
  }

  private _deposit(account: address, amount: number): void {
    this._requireActive();

    this.deposits[account] += amount;
    this.depositTimestamps[account] = block.timestamp;
    this.totalDeposited += amount;

    this.Deposited.emit(account, amount, block.timestamp);
  }

  private _requireOwner(): void {
    if (msg.sender != this.owner) {
      throw new NotOwner(msg.sender);
    }
  }

  private _requireActive(): void {
    if (this.status == VaultStatus.Paused) {
      throw new VaultPaused();
    }
  }
}
