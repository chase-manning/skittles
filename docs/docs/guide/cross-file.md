---
sidebar_position: 8
title: Cross File Support
---

# Cross File Support

Skittles supports sharing types, functions and constants across multiple contract files. You can define types in one file and import them where you need them, just like in any TypeScript project.

## Shared Types

Type aliases (structs), interfaces (contract interfaces) and enums defined in one file can be used in any other contract file:

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

Imports work like standard TypeScript: define your shared types in one file and import them in your contracts.

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

Skittles scans all files in your contracts directory and makes shared definitions available to any contract that uses them. Only the types, enums, functions and constants that a contract references are included in its generated Solidity. Unused definitions are excluded.

## External Contract Calls

Smart contracts often need to interact with other deployed contracts. Skittles supports this through interfaces and the `Contract<T>()` helper.

### Define an Interface

First, define a TypeScript interface for the external contract:

```typescript title="contracts/IToken.ts"
import { address } from "skittles";

export default interface IToken {
  name: string;
  totalSupply: number;
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

  public getTokenName(): string {
    return this.token.name;
  }

  public getBalance(account: address): number {
    return this.token.balanceOf(account);
  }

  public withdraw(to: address, amount: number): void {
    this.token.transfer(to, amount);
  }
}
```

Interface properties (such as `name` and `totalSupply`) compile to `view` getter calls. You can read them as normal properties, without parentheses:

```solidity
interface IToken {
    function name() external view returns (string memory);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract Vault {
    IToken internal token;

    constructor(address tokenAddress) {
        token = IToken(tokenAddress);
    }

    function getTokenName() public view virtual returns (string memory) {
        return token.name();
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

If you change shared types, functions or constants, every file is recompiled, not only the contracts that use them. See [Incremental Compilation](/guide/configuration#incremental-compilation) for details.
