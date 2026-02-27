---
sidebar_position: 8
title: Cross File Support
---

# Cross File Support

Skittles supports sharing types, functions, and constants across multiple contract files. Organize your project just like you would any TypeScript application — define types in one file and import them wherever you need them.

## Shared Types

Type aliases (structs), interfaces (contract interfaces), and enums defined in one file can be used in any other contract file:

```typescript title="contracts/types.ts"
import { address } from "skittles";

export enum VaultStatus {
  Active,
  Paused,
}

export type StakeInfo = {
  amount: number;
  timestamp: number;
  account: address;
};

export interface IStaking {
  getStakeInfo(account: address): StakeInfo;
}
```

```typescript title="contracts/Staking.ts"
import { VaultStatus, StakeInfo } from "./types";

export class Staking {
  public status: VaultStatus;

  public getStakeInfo(account: address): StakeInfo {
    let info: StakeInfo = {
      amount: this.deposits[account],
      timestamp: this.depositTimestamps[account],
      account: account,
    };
    return info;
  }
}
```

Imports work just like standard TypeScript. Define your shared types in one file, import them in your contracts, and Skittles handles the rest.

## Shared Functions

Functions declared at file level (outside any class) are available to all contracts:

```typescript title="contracts/utils.ts"
function calculateFee(amount: number, bps: number): number {
  return (amount * bps) / 10000;
}
```

```typescript title="contracts/Vault.ts"
export class Vault {
  withdraw(amount: number): void {
    let fee: number = calculateFee(amount, 50);
    // ...
  }
}
```

Arrow functions work the same way:

```typescript
const calculateFee = (amount: number, bps: number): number => {
  return (amount * bps) / 10000;
};
```

## Shared Constants

Constants declared at file level can be shared across your contracts:

```typescript title="contracts/constants.ts"
const MAX_FEE = 500;
const FEE_DENOMINATOR = 10000;
```

```typescript title="contracts/Vault.ts"
export class Vault {
  withdraw(amount: number): void {
    let fee: number = (amount * MAX_FEE) / FEE_DENOMINATOR;
  }
}
```

## How It Works

Skittles automatically scans all files in your contracts directory and makes shared definitions available everywhere.

## External Contract Calls

Smart contracts often need to interact with other deployed contracts. Skittles supports this through interfaces and the `Contract<T>()` helper.

### Define an Interface

First, define a TypeScript interface for the external contract:

```typescript title="contracts/IToken.ts"
import { address } from "skittles";

export default interface IToken {
  balanceOf(account: address): number;
  transfer(to: address, amount: number): boolean;
}
```

### Call the External Contract

Use `Contract<T>(address)` to create a typed reference to a deployed contract:

```typescript title="contracts/Vault.ts"
import { address, msg, Contract } from "skittles";
import IToken from "./IToken";

export class Vault {
  private token: IToken;

  constructor(tokenAddress: address) {
    this.token = Contract<IToken>(tokenAddress);
  }

  public getBalance(account: address): number {
    return this.token.balanceOf(account);
  }

  public withdraw(to: address, amount: number): void {
    this.token.transfer(to, amount);
  }
}
```

This compiles to standard Solidity interface calls:

```solidity
interface IToken {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract Vault {
    IToken internal token;

    constructor(address tokenAddress) {
        token = IToken(tokenAddress);
    }

    function getBalance(address account) public view virtual returns (uint256) {
        return token.balanceOf(account);
    }

    function withdraw(address to, uint256 amount) public virtual {
        token.transfer(to, amount);
    }
}
```

### Interface as Function Parameter

You can also pass contract references as function parameters:

```typescript
public getBalance(token: IToken, account: address): number {
  return token.balanceOf(account);
}
```

## Cache Invalidation

If you change shared types, functions, or constants, all contracts that use them are automatically recompiled. See [Incremental Compilation](/guide/configuration#incremental-compilation) for details.
