---
sidebar_position: 3
title: Functions
---

# Functions

Class methods define the actions users and other contracts can call on your contract. Skittles infers state mutability from each method body and maps TypeScript visibility modifiers, overloads and parameter defaults to Solidity.

## Basic Functions

Methods on a contract class can be pure calculations, read-only lookups or state-changing transactions:

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

You don't need to annotate how your functions interact with the blockchain. Skittles analyses each function body to infer its Solidity mutability:

| Access Pattern | Behaviour |
| --- | --- |
| No `this.*` or EVM global access | Generates a pure function. Performs computation only, with no blockchain data needed (free to call) |
| Reads `this.*` only | Generates a view function. Can be called without a transaction (free) |
| Reads EVM globals (`msg.sender`, `block.*`, `tx.*`, `self`, `gasleft()`) | Generates a view function. Can be called without a transaction (free) |
| Writes `this.*` | Generates a nonpayable function. Requires a transaction (costs gas) |
| Accesses `msg.value` | Generates a payable function. Can receive ETH payments |

Mutability inference also propagates through call chains. If function `A` calls `this.B()`, and `B` writes state, then `A` is also marked as state modifying. Skittles uses a fixpoint iteration to handle indirect call chains.

## Visibility

Function visibility controls who can call a method. Both `private` and `protected` methods compile to Solidity internal functions so child contracts can use them, while `public` stays public:

| TypeScript | Behaviour |
| --- | --- |
| `public` (or no modifier) | Generated as Solidity public. Anyone can call this function |
| `private` | Generated as Solidity internal. Restricted to this contract in TypeScript |
| `protected` | Generated as Solidity internal. Callable from this contract and child contracts |
| `static` methods | Internal helpers (not callable externally) |

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

## Function Overloading

TypeScript supports function overloading through overload signatures, and Skittles compiles these into separate Solidity functions. This is common in Solidity standards such as ERC721's `safeTransferFrom`:

```typescript
class Token {
  transfer(to: address, amount: number): boolean;
  transfer(to: address, amount: number, data: string): boolean;
  transfer(to: address, amount: number, data?: string): boolean {
    // implementation
    return true;
  }
}
```

The overload signatures (without bodies) define the public API, and the implementation signature (with the body) provides the logic. Skittles generates a separate Solidity function for each overload signature:

- The overload with the most parameters gets the implementation body
- Shorter overloads forward to the longest overload with default values

## Default Parameter Values

Function parameters can have default values. Skittles generates overloaded Solidity functions so callers can omit trailing arguments:

```typescript
class Auction {
  public bid(amount: number, maxGas: number = 100000): boolean {
    // implementation
    return true;
  }
}
```

This generates two Solidity functions:

- `bid(uint256 amount, uint256 maxGas)`: the full implementation
- `bid(uint256 amount)`: a forwarding overload that calls `bid(amount, 100000)`

You can also set defaults on more than one parameter. Each trailing default creates an additional overload:

```typescript
class Auction {
  public configure(a: number, b: number = 5, c: number = 10): number {
    return a + b + c;
  }
}
```

This generates three Solidity functions:

- `configure(uint256 a, uint256 b, uint256 c)`: full implementation
- `configure(uint256 a, uint256 b)`: forwards to `configure(a, b, 10)`
- `configure(uint256 a)`: forwards to `configure(a, 5, 10)`

:::caution
Default-valued parameters must be contiguous and trailing. Putting a non-default parameter after a default (for example, `f(a: number = 1, b: number)`) is rejected by the compiler, even though it is valid TypeScript. List all required (non-default) parameters first, followed by all parameters with defaults.
:::

:::info
Constructor parameters also support default values, but they compile differently: default parameters become local variable declarations inside the constructor body instead of generating overloads.
:::

## Arrow Functions

Arrow function properties work just like regular methods:

```typescript
class Token {
  private _validate = (amount: number): boolean => {
    return amount > 0;
  };
}
```

## Multiple Return Values

Functions can return multiple values using TypeScript tuple types. This is common in Solidity for functions such as `getReserves()`:

```typescript
class Pair {
  private reserve0: number = 0;
  private reserve1: number = 0;

  getReserves(): [number, number, number] {
    return [this.reserve0, this.reserve1, block.timestamp];
  }
}
```

The tuple return type `[number, number, number]` compiles to Solidity's multi-value return `returns (uint256, uint256, uint256)`, and the array literal `[a, b, c]` compiles to a Solidity tuple `(a, b, c)`.

You can also destructure tuple return values directly:

```typescript
class Pair {
  private reserve0: number = 0;
  private reserve1: number = 0;

  getReserves(): [number, number] {
    return [this.reserve0, this.reserve1];
  }

  public getSum(): number {
    const [r0, r1] = this.getReserves();
    return r0 + r1;
  }
}
```

This compiles to Solidity's native tuple destructuring: `(uint256 r0, uint256 r1) = getReserves();`

## Getters and Setters

You can use TypeScript `get` and `set` accessors on contract classes:

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

Name a method `receive` to handle plain ETH transfers when someone sends ETH directly to your contract:

```typescript
class Staking {
  public receive(): void {
    this._deposit(msg.sender, msg.value);
  }
}
```

Name a method `fallback` to handle calls to functions that don't exist on your contract.

## Require Conversion

When you write `if (condition) throw new Error(...)`, Skittles converts it into a Solidity require statement with the condition negated:

```typescript
// TypeScript
if (this.balances[msg.sender] < amount) {
  throw new Error("Insufficient balance");
}
```

Skittles flips comparison operators when negating the condition (`<` becomes `>=`, `==` becomes `!=` and so on) and passes the error message to Solidity's require statement.

:::info
This conversion only applies when the `if` block contains a single `throw new Error(...)` statement with no `else` branch. Custom errors (`SkittlesError`) are compiled differently.
:::

## Standalone Functions

Functions declared outside classes (at file level) are compiled as internal helper functions available to all contracts in that file:

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

## Type Guards

TypeScript type guard functions using the `is` keyword are supported. The `is` annotation is stripped and the function compiles to a standard boolean-returning internal function:

```typescript
enum Status { Active, Paused, Stopped }

function isActive(s: Status): s is Status.Active {
  return s == Status.Active;
}

export class Vault {
  status: Status;

  public doAction(): void {
    if (isActive(this.status)) {
      // ...
    }
  }
}
```
