---
sidebar_position: 11
title: Under the Hood
---

# Under the Hood

This section is for developers who want to understand how Skittles works internally. If you're just getting started with smart contracts, you can safely skip this — everything covered here happens automatically.

## How Skittles Works

Skittles is a TypeScript to Solidity compiler. You write smart contracts as TypeScript classes, and Skittles compiles them into clean, readable Solidity source code. Hardhat (or any Solidity toolchain) then compiles that Solidity to EVM bytecode that runs on the blockchain.

```
TypeScript (.ts) → Parser → IR → Codegen → Solidity (.sol) → Hardhat → ABI + Bytecode
```

### The Three Stage Pipeline

1. **Parse** — Your TypeScript is parsed using the official TypeScript compiler API. Classes become contracts, properties become state variables, methods become functions.

2. **Generate** — The intermediate representation is converted to valid Solidity. Type mappings, visibility, state mutability inference, and optimizations are applied automatically.

3. **Compile** — The generated Solidity is written to `build/solidity/`. Hardhat (or another Solidity toolchain) compiles it to ABI and EVM bytecode.

## Type Mappings

Here's how TypeScript types map to Solidity types:

| TypeScript | Solidity | Notes |
| --- | --- | --- |
| `number` | `uint256` | All numbers are unsigned 256-bit integers |
| `string` | `string` | UTF-8 strings |
| `boolean` | `bool` | `true` / `false` |
| `address` | `address` | Ethereum address |
| `bytes` | `bytes` | Raw byte data |
| `Record<K, V>` | `mapping(K => V)` | Key-value storage |
| `T[]` | `T[]` | Dynamic arrays |
| Type alias | `struct` | Custom data structures |
| Interface | Contract interface | External API definition |
| Enum | `enum` | Named constants |

## Visibility Mappings

| TypeScript | Solidity | Notes |
| --- | --- | --- |
| `public` (or no modifier) | `public` | Generates an automatic getter |
| `private` | `internal` | More gas-efficient than Solidity's `private` |
| `protected` | `internal` | Same as `private` in output |
| `static readonly` | `constant` | Compile-time constant |
| `readonly` | `immutable` | Set once at deployment |

## State Mutability Inference

Skittles analyzes each function body to determine its Solidity state mutability:

| Access Pattern | Solidity Mutability |
| --- | --- |
| No `this.*` access | `pure` |
| Reads `this.*` only | `view` |
| Writes `this.*`, emits events, or deletes state | (default, no annotation) |
| Accesses `msg.value` | `payable` |

This inference propagates through call chains — if function A calls function B, and B writes state, then A is also marked as state-modifying.

## Automatic Optimizations

Skittles applies several optimizations to generate idiomatic Solidity:

- **`if/throw` → `require()`**: When an `if` block contains only `throw new Error("message")` with no `else`, it's converted to `require()` with the condition negated
- **`private` → `internal`**: TypeScript `private` maps to Solidity `internal` rather than `private` for better gas efficiency
- **`virtual` by default**: All functions are marked `virtual` so child contracts can override them
- **Address wrapping**: 42-character hex string literals are automatically wrapped in `address(...)`
- **Memory annotations**: `memory` keywords are added to string and bytes parameters automatically
- **`for...of` desugaring**: `for...of` loops over arrays are converted to index-based `for` loops
- **`switch/case` → `if/else`**: Switch statements are converted to if/else chains (Solidity has no native switch)
- **`Number.MAX_VALUE` → `type(uint256).max`**: Maximum integer value
- **Template literals → `string.concat()`**: Template strings are converted to Solidity string concatenation

## Generated Solidity Example

Here's what a simple TypeScript contract looks like after compilation:

**Input (TypeScript):**

```typescript title="contracts/Token.ts"
import { address, msg } from "skittles";

export class Token {
  totalSupply: number = 0;
  private balances: Record<address, number> = {};

  constructor(supply: number) {
    this.totalSupply = supply;
    this.balances[msg.sender] = supply;
  }

  balanceOf(account: address): number {
    return this.balances[account];
  }

  transfer(to: address, amount: number): boolean {
    if (this.balances[msg.sender] < amount) {
      throw new Error("Insufficient balance");
    }
    this.balances[msg.sender] -= amount;
    this.balances[to] += amount;
    return true;
  }
}
```

**Output (Solidity):**

```solidity title="build/solidity/Token.sol"
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Token {
    uint256 public totalSupply;
    mapping(address => uint256) internal balances;

    constructor(uint256 supply) {
        totalSupply = supply;
        balances[msg.sender] = supply;
    }

    function balanceOf(address account) public view virtual returns (uint256) {
        return balances[account];
    }

    function transfer(address to, uint256 amount) public virtual returns (bool) {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[to] += amount;
        return true;
    }
}
```

Notice the automatic transformations:

- `number` → `uint256`, `Record<address, number>` → `mapping(address => uint256)`
- `private` → `internal`
- `balanceOf` is marked `view` (only reads state)
- `if/throw` is optimized to `require()`
- Functions are marked `virtual` by default
- String parameters get `memory` annotations

## Why Solidity?

Skittles compiles to Solidity rather than directly to EVM bytecode for several important reasons:

- **Security audits**: Solidity has the largest ecosystem of security auditors and automated analysis tools
- **Etherscan verification**: You can verify your generated Solidity on Etherscan and other block explorers, making your contracts transparent
- **Tooling compatibility**: Works with every existing Solidity tool — Hardhat, Foundry, Remix, Slither, and more
- **Readability**: The generated code is human-readable, so you can always inspect what's being deployed
- **Trust**: Users and auditors can verify the generated Solidity matches the TypeScript source
