---
sidebar_position: 1
title: Type System
---

# Type System

Skittles maps TypeScript types to Solidity types at compile time. This page covers every supported type and how it translates.

## Primitive Types

| TypeScript | Solidity  | Notes                                     |
| ---------- | --------- | ----------------------------------------- |
| `number`   | `uint256` | All numbers are unsigned 256 bit integers |
| `string`   | `string`  | UTF-8 strings                             |
| `boolean`  | `bool`    | `true` / `false`                          |

```typescript
class Example {
  count: number = 0; // uint256 public count;
  name: string = "hello"; // string public name = "hello";
  active: boolean = true; // bool public active = true;
}
```

## Ethereum Types

Import `address` and `bytes` from `"skittles"`:

```typescript
import { address, bytes } from "skittles";

class Example {
  owner: address = msg.sender; // address public owner;
  data: bytes = ""; // bytes public data;
}
```

| TypeScript | Solidity  |
| ---------- | --------- |
| `address`  | `address` |
| `bytes`    | `bytes`   |

Address literals (42 character hex strings starting with `0x`) are automatically wrapped in `address(...)`:

```typescript
// TypeScript
const zero: address = "0x0000000000000000000000000000000000000000";

// Generates: address(0x0000000000000000000000000000000000000000)
```

## Mappings

Use `Record<K, V>` to create Solidity mappings:

```typescript
import { address } from "skittles";

class Token {
  balances: Record<address, number> = {};
  // mapping(address => uint256) public balances;

  allowances: Record<address, Record<address, number>> = {};
  // mapping(address => mapping(address => uint256)) public allowances;
}
```

Nested `Record` types create nested mappings. This is commonly used for ERC20 allowances.

## Arrays

Use `T[]` for dynamic arrays:

```typescript
class Example {
  owners: address[] = [];
  // address[] public owners;

  values: number[] = [];
  // uint256[] public values;
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

## Structs

TypeScript type aliases with object shapes compile to Solidity structs:

```typescript title="contracts/types.ts"
import { address } from "skittles";

export type StakeInfo = {
  amount: number;
  timestamp: number;
  account: address;
};
```

```solidity title="Generated Solidity"
struct StakeInfo {
    uint256 amount;
    uint256 timestamp;
    address account;
}
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

TypeScript interfaces compile to Solidity contract interfaces. Use interfaces to define the external API of a contract:

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

```solidity title="Generated Solidity"
interface IToken {
    function name() external returns (string memory);
    function symbol() external returns (string memory);
    function totalSupply() external returns (uint256);
    function balanceOf(address account) external returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}
```

Properties are converted to getter function signatures. Methods are converted to external function signatures.

### Implementing Interfaces

Use the `implements` keyword to implement an interface. This generates a Solidity `is` clause:

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

```solidity title="Generated Solidity"
contract Token is IToken {
    // ...
}
```

Interfaces can be shared across contract files. See [Cross File Support](/guide/cross-file).

## Enums

TypeScript enums compile to Solidity enums:

```typescript title="contracts/types.ts"
export enum VaultStatus {
  Active,
  Paused,
}
```

```solidity title="Generated Solidity"
enum VaultStatus { Active, Paused }
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
  const balance = this.balances[sender]; // inferred as uint256
  const valid = amount > 0;     // inferred as bool
  // ...
}
```

The compiler infers types from:

- Literal values: numbers → `uint256`, strings → `string`, booleans → `bool`
- `msg.sender` → `address`, `msg.value` → `uint256`
- `block.timestamp`, `block.number` → `uint256`
- Property access on `this` → the type of the state variable
- Mapping/array access → the value type of the mapping/array
- Comparison operators → `bool`

Function parameters and return types must always be explicitly typed.

## Void

Functions that return nothing use `void`:

```typescript
transfer(to: address, amount: number): void {
  // No return statement needed
}
```

This generates a Solidity function with no `returns` clause.
