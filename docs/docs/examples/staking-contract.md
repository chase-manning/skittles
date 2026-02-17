---
sidebar_position: 2
title: Staking Contract
---

# Staking Contract Example

A staking vault that accepts ETH deposits, tracks balances per user, charges withdrawal fees, and includes admin controls for pausing.

## Shared Types

```typescript title="contracts/types.ts"
import { address } from "skittles";

export enum VaultStatus {
  Active,
  Paused,
}

export interface StakeInfo {
  amount: number;
  timestamp: number;
  account: address;
}
```

## Contract

```typescript title="contracts/Staking.ts"
import {
  address,
  msg,
  block,
  SkittlesEvent,
  SkittlesError,
  Indexed,
} from "skittles";
import { VaultStatus, StakeInfo } from "./types";

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

  NotOwner: SkittlesError<{ caller: address }>;
  VaultPaused: SkittlesError<{}>;
  InsufficientDeposit: SkittlesError<{
    account: address;
    deposited: number;
    requested: number;
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
      throw this.InsufficientDeposit(
        msg.sender,
        this.deposits[msg.sender],
        amount,
      );
    }

    let fee: number =
      (amount * Staking.FEE_BASIS_POINTS) / Staking.BASIS_POINTS_DENOMINATOR;
    let payout: number = amount - fee;

    this.deposits[msg.sender] -= amount;
    this.totalDeposited -= amount;
    this.totalFees += fee;

    this.Withdrawn.emit(msg.sender, payout);
  }

  public getStakeInfo(account: address): StakeInfo {
    let info: StakeInfo = {
      amount: this.deposits[account],
      timestamp: this.depositTimestamps[account],
      account: account,
    };
    return info;
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
      throw this.NotOwner(msg.sender);
    }
  }

  private _requireActive(): void {
    if (this.status == VaultStatus.Paused) {
      throw this.VaultPaused();
    }
  }
}
```

## Key Patterns

This example demonstrates:

- **Cross file types**: `VaultStatus` enum and `StakeInfo` struct imported from a shared types file
- **`receive()`**: A special function called when the contract receives plain ETH transfers
- **`msg.value`**: Accessing `msg.value` makes `deposit()` and `receive()` payable automatically
- **`block.timestamp`**: Accessing block context for deposit timestamps
- **`static readonly` constants**: `FEE_BASIS_POINTS` and `BASIS_POINTS_DENOMINATOR` compile to Solidity `constant`
- **`readonly` immutable**: `owner` is set once at deployment and cannot be changed
- **Struct construction**: `StakeInfo` is created with an object literal and returned
- **Custom errors with `SkittlesError<T>`**: Typed revert reasons for `NotOwner`, `VaultPaused`, and `InsufficientDeposit`
- **Admin pattern**: `_requireOwner()` and `_requireActive()` as private guard functions

## Running This Example

```bash
git clone https://github.com/chase-manning/skittles.git
cd skittles/example
yarn install
yarn compile
yarn test
```
