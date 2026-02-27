---
sidebar_position: 1
title: Type System
---

# Type System

Skittles uses familiar TypeScript types for your smart contracts. Here's how to use them.

## Primitive Types

| TypeScript | Description                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| `number`   | Used for amounts, counters, timestamps — represents a whole number (unsigned, up to 256 bits)           |
| `string`   | Used for names, symbols, text data — UTF-8 encoded strings                                               |
| `boolean`  | Used for flags and conditions — `true` or `false`                                                        |

```typescript
class Example {
  count: number = 0;
  name: string = "hello";
  active: boolean = true;
}
```

## Ethereum Types

Import `address` and `bytes` from `"skittles"`:

```typescript
import { address, bytes } from "skittles";

class Example {
  owner: address = msg.sender;
  data: bytes = "";
}
```

| TypeScript | Description                                                   |
| ---------- | ------------------------------------------------------------- |
| `address`  | Represents wallet addresses and contract addresses (20 bytes) |
| `bytes`    | Represents raw binary data                                    |

Address literals are 42 character hex strings starting with `0x`:

```typescript
const zero: address = "0x0000000000000000000000000000000000000000";
```

## Mappings

Use `Record<K, V>` for key-value storage on the blockchain (like a dictionary or map):

```typescript
import { address } from "skittles";

class Token {
  balances: Record<address, number> = {};

  allowances: Record<address, Record<address, number>> = {};
}
```

Nested `Record` types create nested mappings. This is perfect for storing balances, allowances, and other key-value data that needs persistent storage.

## Arrays

Use `T[]` for dynamic arrays:

```typescript
class Example {
  owners: address[] = [];
  values: number[] = [];
}
```

Array methods `push()` and `pop()` are supported:

```typescript
this.owners.push(newOwner);
this.owners.pop();
```

Array `.length` is accessible for iteration:

```typescript
for (let i: number = 0; i < this.owners.length; i++) {
  // ...
}
```

### Readonly Arrays

Use `readonly T[]` to create arrays that can only be modified in the constructor. After deployment, any attempt to push, pop, or modify elements will revert:

```typescript
class Registry {
  admins: readonly address[] = [];

  constructor() {
    this.admins.push(msg.sender); // allowed in constructor
  }

  isAdmin(addr: address): boolean {
    for (let i: number = 0; i < this.admins.length; i++) {
      if (this.admins[i] == addr) return true;
    }
    return false;
  }
}
```

Both `readonly T[]` and `ReadonlyArray<T>` syntax are supported. You can also use the `readonly` modifier on the property:

```typescript
class Config {
  readonly values: number[] = [];
}
```

## Structs

Use TypeScript type aliases with object shapes to define custom data structures:

```typescript title="contracts/types.ts"
import { address } from "skittles";

export type StakeInfo = {
  amount: number;
  timestamp: number;
  account: address;
};
```

Struct instances are created with object literals:

```typescript
let info: StakeInfo = {
  amount: this.deposits[account],
  timestamp: this.depositTimestamps[account],
  account: account,
};
return info;
```

Structs can be shared across contract files. See [Cross File Support](/guide/cross-file).

## Contract Interfaces

Use TypeScript interfaces to define the external API shape of a contract:

```typescript title="contracts/interfaces.ts"
import { address } from "skittles";

export interface IToken {
  name: string;
  symbol: string;
  totalSupply: number;
  balanceOf(account: address): number;
  transfer(to: address, amount: number): boolean;
}
```

Properties represent getter functions. Methods represent callable functions.

### Implementing Interfaces

Use the `implements` keyword to implement an interface:

```typescript title="contracts/Token.ts"
class Token implements IToken {
  public name: string = "MyToken";
  public symbol: string = "MTK";
  public totalSupply: number = 1000000;
  private balances: Record<address, number> = {};

  public balanceOf(account: address): number {
    return this.balances[account];
  }

  public transfer(to: address, amount: number): boolean {
    this.balances[msg.sender] -= amount;
    this.balances[to] += amount;
    return true;
  }
}
```

Interfaces can be shared across contract files. See [Cross File Support](/guide/cross-file).

## Enums

TypeScript enums define a set of named constants:

```typescript title="contracts/types.ts"
export enum VaultStatus {
  Active,
  Paused,
}
```

Use them as state variable types and in comparisons:

```typescript
class Staking {
  public status: VaultStatus;

  public pause(): void {
    this.status = VaultStatus.Paused;
  }

  private _requireActive(): void {
    if (this.status == VaultStatus.Paused) {
      throw this.VaultPaused();
    }
  }
}
```

Enums can be shared across contract files. See [Cross File Support](/guide/cross-file).

## Type Inference

Local variables inside functions can omit explicit types when the type can be inferred:

```typescript
transfer(to: address, amount: number): boolean {
  const sender = msg.sender;    // inferred as address
  const balance = this.balances[sender]; // inferred as number
  const valid = amount > 0;     // inferred as boolean
  // ...
}
```

The compiler infers types from:

- Literal values: numbers are inferred from numeric literals, strings from string literals, booleans from `true`/`false`
- Global variables: `msg.sender` is inferred as `address`, `msg.value` as `number`
- Block properties: `block.timestamp` and `block.number` are inferred as `number`
- Property access on `this` → the type of the state variable
- Mapping/array access → the value type of the mapping/array
- Comparison operators → `boolean`

Function parameters and return types must always be explicitly typed.

## Void

Functions that return nothing use `void`:

```typescript
transfer(to: address, amount: number): void {
  // No return statement needed
}
```
