---
sidebar_position: 3
title: Functions
---

# Functions

Class methods compile to Solidity functions. Skittles automatically infers state mutability and applies optimizations.

## Basic Functions

```typescript
class Token {
  private balances: Record<address, number> = {};

  // Pure function: no state access
  add(a: number, b: number): number {
    return a + b;
  }

  // View function: reads state, does not write
  balanceOf(account: address): number {
    return this.balances[account];
  }

  // Nonpayable function: writes state
  transfer(to: address, amount: number): boolean {
    this.balances[msg.sender] -= amount;
    this.balances[to] += amount;
    return true;
  }
}
```

## State Mutability Inference

You never need to annotate `pure`, `view`, or `payable`. Skittles analyzes each function body to determine mutability:

| Access Pattern                                  | Inferred Mutability      |
| ----------------------------------------------- | ------------------------ |
| No `this.*` access                              | `pure`                   |
| Reads `this.*` only                             | `view`                   |
| Writes `this.*`, emits events, or deletes state | (default, no annotation) |
| Accesses `msg.value`                            | `payable`                |

The inference also propagates through call chains. If function `A` calls `this.B()`, and `B` writes state, then `A` is also marked as state modifying. This uses a fixpoint iteration to handle indirect call chains.

## Visibility

Function visibility follows the same rules as state variables:

| TypeScript                | Solidity                        |
| ------------------------- | ------------------------------- |
| `public` (or no modifier) | `public`                        |
| `private`                 | `internal`                      |
| `protected`               | `internal`                      |
| `static` methods          | `internal` (treated as helpers) |

```typescript
class Token {
  // Public function
  public transfer(to: address, amount: number): boolean {
    /* ... */
  }

  // Internal helper
  private _transfer(from: address, to: address, amount: number): void {
    /* ... */
  }
}
```

## Virtual and Override

By default, all functions are marked `virtual` so they can be overridden by child contracts. Use the `override` keyword to mark a function as overriding a parent:

```typescript
class BaseToken {
  transfer(to: address, amount: number): boolean {
    // base implementation (generated as virtual)
    return true;
  }
}

class MyToken extends BaseToken {
  override transfer(to: address, amount: number): boolean {
    // overriding implementation (generated as override)
    return true;
  }
}
```

## Arrow Functions

Arrow function properties are compiled as methods:

```typescript
class Token {
  private _validate = (amount: number): boolean => {
    return amount > 0;
  };
}
```

This generates the same Solidity as a regular method declaration.

## Getters and Setters

TypeScript `get` and `set` accessors compile to Solidity functions:

```typescript
class Token {
  private _paused: boolean = false;

  get paused(): boolean {
    return this._paused;
  }

  set paused(value: boolean) {
    this._paused = value;
  }
}
```

## Receive and Fallback

Name a method `receive` to generate a Solidity `receive()` function (called when the contract receives plain ETH):

```typescript
class Staking {
  public receive(): void {
    this._deposit(msg.sender, msg.value);
  }
}
```

```solidity title="Generated Solidity"
receive() external payable {
    _deposit(msg.sender, msg.value);
}
```

Similarly, name a method `fallback` to generate a `fallback()` function.

## Require Optimization

Skittles automatically converts the `if (condition) throw` pattern to Solidity `require()`:

```typescript
// TypeScript
if (this.balances[msg.sender] < amount) {
  throw new Error("Insufficient balance");
}

// Generated Solidity
require(balances[msg.sender] >= amount, "Insufficient balance");
```

The condition is automatically negated, and comparison operators are flipped (`<` becomes `>=`, `==` becomes `!=`, etc.). This produces idiomatic Solidity that is familiar to auditors.

:::info
This optimization only applies when the `if` block contains a single `throw new Error(...)` statement with no `else` branch. Custom errors (`SkittlesError`) use `revert` instead and are not converted to `require()`.
:::

## Standalone Functions

Functions declared outside of classes (at file level) are compiled as `internal` helper functions inside every contract in that file:

```typescript title="contracts/utils.ts"
function calculateFee(amount: number, bps: number): number {
  return (amount * bps) / 10000;
}
```

These can also be arrow functions:

```typescript
const calculateFee = (amount: number, bps: number): number => {
  return (amount * bps) / 10000;
};
```

When shared across files, standalone functions are available to all contracts. See [Cross File Support](/guide/cross-file).
