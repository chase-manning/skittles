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
This optimization is only applied to simple value types like `number`, `address`, `boolean`, and `bytes32`. Reference types like `string` cannot use this optimization and will be stored as regular state variables.
:::

## Readonly Arrays

Use `readonly` on arrays to prevent modification after initialization. Readonly arrays are stored internally and a public getter is automatically generated:

```typescript
class AdminRegistry {
  public readonly admins: address[] = [];

  constructor(admin: address) {
    this.admins.push(admin);
  }
}
```

This compiles to an `internal` storage array with a public `getAdmins()` view function, so external callers can read the array but cannot modify it.

You can initialize readonly arrays in the constructor, but the getter provides read-only access to the full array.

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

### Default Parameter Values

Constructor parameters can have default values, just like in TypeScript:

```typescript
class Token {
  totalSupply: number = 0;
  private balances: Record<address, number> = {};

  constructor(initialSupply: number = 1000000) {
    this.totalSupply = initialSupply;
    this.balances[msg.sender] = initialSupply;
  }
}
```

Parameters with default values are baked into the contract at compile time — you don't need to pass them when deploying. This makes your contracts simpler to deploy while still keeping the logic readable.
