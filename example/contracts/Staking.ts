import {
  address,
  msg,
  block,
  SkittlesEvent,
  Indexed,
} from "skittles";

class NotOwner extends Error {
  constructor(caller: address) {
    super("");
  }
}

class VaultPaused extends Error {
  constructor() {
    super("");
  }
}

class InsufficientDeposit extends Error {
  constructor(account: address, deposited: number, requested: number) {
    super("");
  }
}

enum VaultStatus {
  Active,
  Paused,
}

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
