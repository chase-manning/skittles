---
sidebar_position: 11
title: Under the Hood
---

# Under the Hood

This section explains how Skittles works internally. If you're just getting started with smart contracts, you can skip it because everything covered here happens automatically.

## How Skittles Works

Skittles is a TypeScript-to-Solidity compiler. You write smart contracts as TypeScript classes, and Skittles generates Solidity source code from them. Hardhat (or solc) then compiles that Solidity to ABI and EVM bytecode.

```
TypeScript (.ts) → Parser → IR → Analysis → Codegen → Solidity (.sol) → Hardhat → ABI + Bytecode
```

### The Four Stage Pipeline

1. **Parse:** Skittles parses your TypeScript using the official TypeScript compiler API. Classes become contracts, properties become state variables and methods become functions.

2. **Analyse:** The compiler checks the parsed code for issues such as unreachable code (statements after `return` or `throw`) and unused local variables, and reports them as warnings.

3. **Generate:** The intermediate representation is converted to Solidity. Type mappings, visibility, state mutability inference and optimisations are applied here.

4. **Compile:** The generated Solidity is written to `artifacts/solidity/`. Hardhat (or another Solidity compiler) compiles it to ABI and EVM bytecode.

### Source Maps

When Skittles generates Solidity, it writes a source map file (`.sol.map`) alongside each `.sol` file. The map links Solidity lines generated from your TypeScript declarations and statements back to the original TypeScript file and line number. Lines the compiler adds itself (such as pragmas, braces and blank lines) have no entry.

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

Each key is a Solidity line number and each value is the corresponding TypeScript line number, so you can trace a Solidity compiler error or runtime revert back to your TypeScript source.

## Type Mappings

Here's how TypeScript types map to Solidity types:

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

| TypeScript | Solidity | Notes |
| --- | --- | --- |
| `public` (or no modifier) | `public` | Generates an automatic getter |
| `private` | `internal` | Both `private` and `protected` compile to `internal` |
| `protected` | `internal` | Compiles to `internal`; use this for members child contracts need |
| `static readonly` | `constant` | Compile-time constant |
| `readonly` | `immutable` | Set once at deployment |

## State Mutability Inference

Skittles analyses each function body to determine its Solidity state mutability:

| Access Pattern | Solidity Mutability |
| --- | --- |
| No `this.*` or EVM global access | `pure` |
| Reads `this.*` or EVM globals only | `view` |
| Writes `this.*`, emits events or deletes state | (default, no annotation) |
| Accesses `msg.value` | `payable` |

Mutability propagates through call chains. If function A calls function B and B writes state, A is also treated as state-modifying. For external contract calls via `Contract<T>()`, the compiler uses any mutability annotations already present on the interface methods. If every external call in a function targets a method annotated as `view` or `pure` (for example from property signatures or `implements` resolution), the calling function's mutability is worked out from its own body. Unannotated interface methods are treated as state-modifying.

## Automatic Transformations

Skittles applies these transformations when generating Solidity:

- **`if/throw` → `require()`**: When an `if` block contains only `throw new Error("message")` with no `else`, it compiles to `require()` with the condition negated.
- **String truthiness → length check**: `if (str)` compiles to `if (bytes(str).length > 0)` and `if (!str)` compiles to `if (bytes(str).length == 0)`, because Solidity doesn't support implicit string-to-bool conversion.
- **`private` and `protected` → `internal`**: Both TypeScript `private` and `protected` compile to Solidity `internal`. Use `protected` for members that child contracts need, because TypeScript doesn't allow a child class to access `private` members.
- **`virtual` by default**: All functions are marked `virtual` so child contracts can override them.
- **Address wrapping**: 42-character hex string literals are wrapped in `address(...)`.
- **Memory annotations**: `memory` is added to string and bytes parameters.
- **`for...of` desugaring**: `for...of` loops over arrays are converted to index-based `for` loops.
- **`switch/case` → `if/else`**: Switch statements are converted to if/else chains (Solidity has no native switch).
- **`Number.MAX_VALUE` → `type(uint256).max`**: Maximum integer value.
- **`Math.min(a, b)` / `Math.max(a, b)` → helper functions**: Generates `internal` `_min` and `_max` helpers so each argument is evaluated once.
- **`Math.pow(a, b)` → `a ** b`**: Uses Solidity's exponentiation operator.
- **`Math.sqrt(x)` → Babylonian method**: Generates an `internal` `_sqrt` helper function.
- **Template literals → `string.concat()`**: Template strings are converted to Solidity string concatenation.
- **`**=` → `x = x ** y`**: The `**=` compound assignment is desugared because Solidity has no `**=` operator.
- **Local variable shadowing prevention**: When a local variable has the same name as a state variable, it's renamed with an underscore prefix (for example `result` → `_result`) to avoid Solidity shadowing warnings.
- **Parameter shadowing prevention**: When a function parameter has the same name as another function in the contract (such as a setter parameter `value` shadowing a getter function `value()`), the parameter is renamed to avoid Solidity shadowing warnings.

## Generated Solidity Example

Here's a TypeScript contract and the Solidity Skittles writes to `artifacts/solidity/`:

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
- `if/throw` compiles to `require()`
- Functions are marked `virtual` by default

## Why Solidity?

Skittles compiles to Solidity rather than directly to EVM bytecode:

- **Security reviews**: The generated Solidity can be reviewed by people who read Solidity and checked with existing Solidity analysis tools.
- **Etherscan verification**: You can submit the generated Solidity for verification on Etherscan and other block explorers.
- **Tooling compatibility**: Standard Solidity output works with existing tools such as Hardhat, Foundry, Remix and Slither.
- **Readability**: The generated code is readable, so you can inspect what's being deployed.
- **Trust**: Users and auditors can verify that the generated Solidity matches the TypeScript source.
