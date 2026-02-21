---
sidebar_position: 3
title: Functions
---

# Functions

Class methods define the actions users can take on your contract. Skittles automatically handles optimization and access control.

## Basic Functions

```typescript
class Token {
  private balances: Record<address, number> = {};

  // A pure helper — doesn't touch any contract state
  add(a: number, b: number): number {
    return a + b;
  }

  // A read-only function — looks up state without changing it
  balanceOf(account: address): number {
    return this.balances[account];
  }

  // A state-changing function — modifies balances
  transfer(to: address, amount: number): boolean {
    this.balances[msg.sender] -= amount;
    this.balances[to] += amount;
    return true;
  }
}
```

## State Mutability Inference

You never need to annotate how your functions interact with the blockchain. Skittles analyzes each function body to determine the behavior:

| Access Pattern       | Behavior                                             |
| -------------------- | ---------------------------------------------------- |
| No `this.*` access   | Can be called without connecting to the blockchain (free) |
| Reads `this.*` only  | Can be called without a transaction (free)           |
| Writes `this.*`      | Requires a transaction (costs gas)                   |
| Accesses `msg.value` | Can receive ETH payments                             |

The inference also propagates through call chains. If function `A` calls `this.B()`, and `B` writes state, then `A` is also marked as state modifying. This uses a fixpoint iteration to handle indirect call chains.

## Visibility

Function visibility controls who can call your functions:

| TypeScript                | Behavior                                           |
| ------------------------- | -------------------------------------------------- |
| `public` (or no modifier) | Anyone can call this function                      |
| `private`                 | Only callable from within this contract            |
| `protected`               | Only callable from this contract and child contracts|
| `static` methods          | Internal helpers (not callable externally)         |

```typescript
class Token {
  // Public function - anyone can call
  public transfer(to: address, amount: number): boolean {
    /* ... */
  }

  // Internal helper - only this contract can use
  private _transfer(from: address, to: address, amount: number): void {
    /* ... */
  }
}
```

## Virtual and Override

By default, all functions can be overridden by child contracts. Use the `override` keyword to mark a function as overriding a parent:

```typescript
class BaseToken {
  transfer(to: address, amount: number): boolean {
    // base implementation
    return true;
  }
}

class MyToken extends BaseToken {
  override transfer(to: address, amount: number): boolean {
    // custom implementation that replaces the parent's
    return true;
  }
}
```

## Arrow Functions

Arrow function properties work just like regular methods:

```typescript
class Token {
  private _validate = (amount: number): boolean => {
    return amount > 0;
  };
}
```

## Getters and Setters

TypeScript `get` and `set` accessors work as you'd expect:

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

Name a method `receive` to handle plain ETH transfers to your contract. This function is called when someone sends ETH to your contract:

```typescript
class Staking {
  public receive(): void {
    this._deposit(msg.sender, msg.value);
  }
}
```

Similarly, name a method `fallback` to handle calls to functions that don't exist on your contract.

## Require Optimization

Skittles automatically optimizes your error handling. When you write `if (condition) throw new Error(...)`, Skittles converts it into the most gas-efficient pattern:

```typescript
// TypeScript
if (this.balances[msg.sender] < amount) {
  throw new Error("Insufficient balance");
}
```

The condition is automatically negated, and comparison operators are flipped (`<` becomes `>=`, `==` becomes `!=`, etc.) to produce the most efficient bytecode.

:::info
This optimization only applies when the `if` block contains a single `throw new Error(...)` statement with no `else` branch. Custom errors (`SkittlesError`) use a different optimization pattern.
:::

## Standalone Functions

Functions declared outside of classes (at file level) are compiled as internal helper functions available to all contracts in that file:

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
