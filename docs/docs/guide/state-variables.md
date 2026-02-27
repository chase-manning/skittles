---
sidebar_position: 2
title: State Variables
---

# State Variables

Class properties in your contract become persistent state — they're stored on the blockchain and retained between function calls. Visibility, mutability, and initial values are all controlled through standard TypeScript syntax.

## Visibility

TypeScript access modifiers control who can read your state variables:

| TypeScript                | Notes                                                                         |
| ------------------------- | ----------------------------------------------------------------------------- |
| `public` (or no modifier) | Anyone can read this value on the blockchain                                  |
| `private`                 | Only accessible within the contract and contracts that extend it             |
| `protected`               | Same as `private`                                                             |

```typescript
class Token {
  public name: string = "MyToken";
  public totalSupply: number = 0;
  private balances: Record<address, number> = {};
}
```

:::info
Skittles makes private properties accessible to contracts that extend yours (child contracts). This is the standard pattern for smart contracts and is more gas efficient.
:::

## Initial Values

You can set default values for properties using standard TypeScript syntax:

```typescript
class Token {
  name: string = "MyToken";
  decimals: number = 18;
  paused: boolean = false;
}
```

Mappings and arrays do not get initializers (they are initialized to empty by default):

```typescript
class Token {
  balances: Record<address, number> = {};
  owners: address[] = [];
}
```

## Constants

Use `static readonly` for values that never change and are known at compile time:

```typescript
class Staking {
  static readonly FEE_BASIS_POINTS: number = 50;
  static readonly BASIS_POINTS_DENOMINATOR: number = 10000;
}
```

Reference constants using the class name:

```typescript
let fee: number =
  (amount * Staking.FEE_BASIS_POINTS) / Staking.BASIS_POINTS_DENOMINATOR;
```

## Immutables

Use `readonly` (without `static`) for values that are set once at deployment time and never change. These can only be set in the constructor:

```typescript
class Staking {
  readonly owner: address = msg.sender;
}
```

:::note
For simple value types like `number`, `address`, `boolean`, and `bytes32`, this compiles to Solidity's `immutable` keyword for gas optimization. Reference types like `string` will be stored as regular state variables.
:::

### Readonly Arrays

Use `readonly T[]` (or the `readonly` modifier on an array property) to create arrays that are locked after construction. The array can be populated in the constructor, but any push, pop, or element modification after deployment will revert:

```typescript
class Registry {
  admins: readonly address[] = [];

  constructor() {
    this.admins.push(msg.sender);
  }
}
```

This is useful for configuration data like admin lists, whitelisted addresses, or other data that should not change after deployment.

## Constructor

Use a standard TypeScript constructor to set initial values when the contract is deployed:

```typescript
class Token {
  totalSupply: number = 0;
  private balances: Record<address, number> = {};

  constructor(initialSupply: number) {
    this.totalSupply = initialSupply;
    this.balances[msg.sender] = initialSupply;
  }
}
```

Constructor parameters follow the same type rules as function parameters.
