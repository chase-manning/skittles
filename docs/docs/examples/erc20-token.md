---
sidebar_position: 1
title: ERC20 Token
---

# ERC20 Token Example

A full ERC20 token implementation with transfers, approvals, events, and custom errors.

## Interface

First, define the token interface:

```typescript title="contracts/IToken.ts"
import { address } from "skittles";

export default interface IToken {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: number;
  balanceOf(account: address): number;
  transfer(to: address, amount: number): boolean;
  approve(spender: address, amount: number): boolean;
  transferFrom(from: address, to: address, amount: number): boolean;
  allowance(owner: address, spender: address): number;
}
```

## Contract

```typescript title="contracts/Token.ts"
import { address, msg, SkittlesEvent, SkittlesError, Indexed } from "skittles";
import IToken from "./IToken";

export class Token implements IToken {
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

  InsufficientBalance: SkittlesError<{
    sender: address;
    balance: number;
    required: number;
  }>;
  InsufficientAllowance: SkittlesError<{
    spender: address;
    allowance: number;
    required: number;
  }>;

  public name: string = "Skittles Token";
  public symbol: string = "SKT";
  public decimals: number = 18;
  public totalSupply: number = 0;

  private balances: Record<address, number> = {};
  private allowances: Record<address, Record<address, number>> = {};

  constructor(initialSupply: number) {
    this.totalSupply = initialSupply;
    this.balances[msg.sender] = initialSupply;
    this.Transfer.emit(
      "0x0000000000000000000000000000000000000000",
      msg.sender,
      initialSupply,
    );
  }

  public balanceOf(account: address): number {
    return this.balances[account];
  }

  public allowance(owner: address, spender: address): number {
    return this.allowances[owner][spender];
  }

  public transfer(to: address, amount: number): boolean {
    this._transfer(msg.sender, to, amount);
    return true;
  }

  public approve(spender: address, amount: number): boolean {
    this._approve(msg.sender, spender, amount);
    return true;
  }

  public transferFrom(from: address, to: address, amount: number): boolean {
    let currentAllowance: number = this.allowances[from][msg.sender];

    if (currentAllowance < amount) {
      throw this.InsufficientAllowance(msg.sender, currentAllowance, amount);
    }

    if (currentAllowance != Number.MAX_VALUE) {
      this._approve(from, msg.sender, currentAllowance - amount);
    }

    this._transfer(from, to, amount);
    return true;
  }

  private _transfer(from: address, to: address, amount: number): void {
    if (this.balances[from] < amount) {
      throw this.InsufficientBalance(from, this.balances[from], amount);
    }
    this.balances[from] -= amount;
    this.balances[to] += amount;
    this.Transfer.emit(from, to, amount);
  }

  private _approve(owner: address, spender: address, amount: number): void {
    this.allowances[owner][spender] = amount;
    this.Approval.emit(owner, spender, amount);
  }
}
```

## Key Patterns

This example demonstrates several Skittles features:

- **`implements IToken`**: TypeScript interface enforcement for type safety in the IDE
- **`SkittlesEvent<T>` with `Indexed<T>`**: Events with indexed parameters for efficient off chain filtering
- **`SkittlesError<T>`**: Gas efficient custom errors with typed parameters
- **Nested mappings**: `Record<address, Record<address, number>>` for the allowances mapping
- **`Number.MAX_VALUE`**: Compiles to `type(int256).max` for unlimited allowance patterns
- **Private helper functions**: `_transfer` and `_approve` encapsulate reusable logic
- **State mutability inference**: `balanceOf` and `allowance` are automatically `view`, `transfer` and `approve` are automatically nonpayable

## Running This Example

This contract is part of the [example project](https://github.com/chase-manning/skittles/tree/main/example) in the Skittles repository:

```bash
git clone https://github.com/chase-manning/skittles.git
cd skittles/example
yarn install
yarn compile
yarn test
```
