---
sidebar_position: 11
title: Under the Hood
---

# Under the Hood

This section is for developers who want to understand how Skittles works internally. If you're just getting started with smart contracts, you can skip this for now. Everything covered here happens automatically when you compile your contracts.

## How Skittles Works

Skittles is a TypeScript-to-Solidity compiler. You write smart contracts as exported TypeScript classes, and Skittles parses them with the official TypeScript compiler, converts them into an intermediate representation and generates standard Solidity source code. Hardhat (or solc) then compiles that Solidity into ABI and EVM bytecode that runs on the blockchain.

Because the output is standard Solidity, you can read the generated files, inspect them with existing Solidity tools or have them reviewed by people who read Solidity. The ABI and bytecode work with tools such as ethers.js, viem, Hardhat and Foundry, and the source can be submitted for verification on block explorers such as Etherscan.

```
TypeScript (.ts) → Parser → IR → Analysis → Codegen → Solidity (.sol) → Hardhat → ABI + Bytecode
```

### The Four Stage Pipeline

1. **Parse**: Your TypeScript is parsed using the official TypeScript compiler API. Exported classes become contracts, properties become state variables and methods become functions.

2. **Analyse**: The parsed code is checked for common issues such as unreachable code (statements after `return` or `throw`) and unused local variables. Skittles reports these as warnings so you can catch mistakes before compiling the Solidity.

3. **Generate**: The intermediate representation is converted to valid Solidity. Type mappings, visibility mappings, state mutability inference and optimisations are applied automatically.

4. **Compile**: The generated Solidity is written to `build/solidity/`. Hardhat (or another Solidity compiler such as solc) compiles it to ABI and EVM bytecode.

### Source Maps

When Skittles generates Solidity, it also writes a source map file (`.sol.map`) alongside each `.sol` file. Each source map links every generated Solidity line back to the original TypeScript file and line number.

For example, if Hardhat reports an error on line 12 of `Token.sol`, you can look up line 12 in `Token.sol.map` to find the corresponding TypeScript line:

```json title="build/solidity/Token.sol.map"
{
  "sourceFile": "contracts/Token.ts",
  "mappings": {
    "4": 1,
    "5": 2,
    "8": 5,
    "12": 9
  }
}
```

Each key is a Solidity line number and each value is the corresponding TypeScript line number. You can use this to trace a Solidity compiler error or runtime revert back to your TypeScript source.

## Type Mappings

TypeScript types map to Solidity types as follows:

| TypeScript | Solidity | Notes |
| --- | --- | --- |
| `number` | `uint256` | All numbers are unsigned 256-bit integers |
| `string` | `string` | UTF-8 strings |
| `boolean` | `bool` | `true` / `false` |
| `address` | `address` | Ethereum address |
| `bytes` | `bytes` | Raw byte data |
| `bytes32` | `bytes32` | Fixed-size 32-byte value (hashes, keys) |
| `Record<K, V>` | `mapping(K => V)` | Key-value storage |
| `T[]` | `T[]` | Dynamic arrays |
| Type alias | `struct` | Custom data structures |
| Interface | Contract interface | External API definition |
| Enum | `enum` | Named constants |

## Visibility Mappings

TypeScript access modifiers map to Solidity visibility and mutability keywords. Both `private` and `protected` members become `internal` so child contracts can use them.

| TypeScript | Solidity | Notes |
| --- | --- | --- |
| `public` (or no modifier) | `public` | Generates an automatic getter |
| `private` | `internal` | Accessible to child contracts, unlike Solidity's `private` |
| `protected` | `internal` | Same as `private` in output, so child contracts can use it |
| `static readonly` | `constant` | Compile-time constant |
| `readonly` | `immutable` | Set once at deployment |

## State Mutability Inference

You don't need to write mutability annotations yourself. Skittles analyses each function body to determine its Solidity state mutability:

| Access Pattern | Solidity Mutability |
| --- | --- |
| No `this.*` access | `pure` |
| Reads `this.*` only | `view` |
| Writes `this.*`, emits events or deletes state | (default, no annotation) |
| Accesses `msg.value` | `payable` |

This inference propagates through call chains. If function A calls function B, and B writes state, then A is also marked as state-modifying. For external contract calls via `Contract<T>()`, the compiler respects already-known mutability annotations on interface methods. If all external calls in a function target methods annotated as `view` or `pure` (for example, from property signatures or `implements` resolution), the wrapper function's mutability is computed from its own body. Unannotated interface methods are treated conservatively as state-modifying.

## Automatic Transformations

During compilation, Skittles rewrites several TypeScript patterns into Solidity:

- **`if/throw` → `require()`**: When an `if` block has no `else` and contains only `throw new Error("message")`, it's converted to `require()` with the condition negated.
- **String truthiness → length check**: `if (str)` compiles to `if (bytes(str).length > 0)` and `if (!str)` compiles to `if (bytes(str).length == 0)`, because Solidity doesn't convert strings to booleans implicitly.
- **`private` → `internal`**: TypeScript `private` and protected members map to Solidity `internal` rather than `private`, so child contracts can use them.
- **`virtual` by default**: All functions are marked `virtual` so child contracts can override them.
- **Address wrapping**: 42-character hex string literals are wrapped in `address(...)`.
- **Memory annotations**: `memory` keywords are added to string and bytes parameters.
- **`for...of` desugaring**: `for...of` loops over arrays are converted to index-based `for` loops.
- **`switch/case` → `if/else`**: Switch statements are converted to `if/else` chains because Solidity has no switch statement.
- **`Number.MAX_VALUE` → `type(uint256).max`**: Compiles to the maximum `uint256` value.
- **`Math.min(a, b)` / `Math.max(a, b)` → helper functions**: Generates internal `_min` and `_max` helpers so each argument is evaluated only once.
- **`Math.pow(a, b)` → `a ** b`**: Uses Solidity's exponentiation operator.
- **`Math.sqrt(x)` → Babylonian method**: Generates an internal `_sqrt` helper function.
- **Template literals → `string.concat()`**: Template strings compile to Solidity `string.concat()` calls.
- **`**=` → `x = x ** y`**: The `**=` compound assignment is expanded because Solidity has no `**=` operator.
- **Local variable shadowing prevention**: When a local variable has the same name as a state variable, it's renamed with an underscore prefix (e.g. `result` → `_result`) to avoid Solidity shadowing warnings.
- **Parameter shadowing prevention**: When a function parameter has the same name as another function in the contract (e.g. a setter parameter `value` shadowing a getter function `value()`), the parameter is renamed to avoid Solidity shadowing warnings.

## Generated Solidity Example

Here's a small TypeScript contract before and after compilation:

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

The compiled output shows several of these transformations:

- `number` → `uint256` and `Record<address, number>` → `mapping(address => uint256)`
- `private` → `internal` on the balances mapping
- `balanceOf` is marked `view` because it only reads state
- `if/throw` is converted to `require()` with the condition negated
- Both functions are marked `virtual` by default

## Why Solidity?

Skittles compiles to Solidity rather than directly to EVM bytecode for several reasons:

- **Security reviews**: The generated Solidity can be reviewed by people who read Solidity and checked with existing analysis tools.
- **Etherscan verification**: You can submit the generated Solidity for verification on Etherscan and other block explorers so anyone can inspect it.
- **Tooling compatibility**: Standard Solidity output works with existing tools such as Hardhat, Foundry, Remix and Slither.
- **Readability**: The generated code is readable Solidity, so you can always inspect what's being deployed.
- **Trust**: Users and reviewers can check that the generated Solidity matches the TypeScript source.
