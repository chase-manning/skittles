---
sidebar_position: 8
title: Cross File Support
---

# Cross File Support

Skittles supports sharing types, functions, and constants across multiple contract files. Before compilation, the compiler pre scans all files in the contracts directory to collect shared definitions, then makes them available to every contract.

## Shared Types

Interfaces (structs) and enums defined in one file can be used in any other contract file:

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

The import syntax is standard TypeScript. Skittles resolves the types across files during the pre scan phase. The generated Solidity includes the struct and enum definitions inline within each contract that uses them.

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

Standalone functions are included as `internal` functions in every contract that references them. Arrow functions work the same way:

```typescript
const calculateFee = (amount: number, bps: number): number => {
  return (amount * bps) / 10000;
};
```

## Shared Constants

Constants declared at file level are inlined into expressions:

```typescript title="contracts/constants.ts"
const MAX_FEE = 500;
const FEE_DENOMINATOR = 10000;
```

```typescript title="contracts/Vault.ts"
export class Vault {
  withdraw(amount: number): void {
    let fee: number = (amount * MAX_FEE) / FEE_DENOMINATOR;
    // MAX_FEE and FEE_DENOMINATOR are inlined as literal values
  }
}
```

## How It Works

The compilation pipeline has two phases:

1. **Pre scan phase**: All `.ts` files in the contracts directory are scanned to collect:
   - Interfaces → struct definitions
   - Enums → enum definitions
   - File level functions → shared function definitions
   - File level `const` declarations → constant values

2. **Compilation phase**: Each contract file is parsed with access to all shared definitions from the pre scan. This means contracts can reference types, functions, and constants from any other file without explicit import resolution at the Solidity level.

## Cache Invalidation

The incremental compilation cache tracks shared definitions separately. If any shared type, function, or constant changes, all dependent contracts are automatically recompiled. See [Incremental Compilation](/guide/configuration#incremental-compilation) for details.
