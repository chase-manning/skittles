---
sidebar_position: 2
title: State Variables
---

# State Variables

Class properties in your contract become persistent state. They're stored on the blockchain and kept between function calls. Visibility, mutability and initial values are all controlled with standard TypeScript syntax.

## Visibility

TypeScript access modifiers control who can read your state variables:

| TypeScript                | Notes                                                                         |
| ------------------------- | ----------------------------------------------------------------------------- |
| `public` (or no modifier) | Anyone can read this value on the blockchain                                  |
| `private`                 | Only accessible within the contract and contracts that extend it              |
| `protected`               | Same as `private`                                                             |

```typescript
class Token {
  public name: string = "MyToken";
  public totalSupply: number = 0;
  private balances: Record<address, number> = {};
}
```

:::info
Skittles compiles `private` and `protected` properties to Solidity `internal`, so contracts that extend yours (child contracts) can still access them.
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

Expressions are also supported in initialisers, including ternary (conditional) expressions:

```typescript
class Token {
  public decimals: number = 18;
  public adjustedDecimals: number = this.decimals > 10 ? 18 : 8;
}
```

Mappings and arrays do not get initialisers because they are initialised as empty by default:

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

Use `readonly` (without `static`) for values that are set once at deployment and never change. You can assign them with an initialiser or in the constructor:

```typescript
class Staking {
  readonly owner: address = msg.sender;
}
```

:::note
This optimisation applies only to simple value types such as `number`, `address`, `boolean` and `bytes32`. Reference types such as `string` cannot use it and are stored as regular state variables.
:::

## Readonly Arrays

Use `readonly` on arrays to prevent changes after initialisation. Readonly arrays are stored internally and Skittles generates a public getter automatically:

```typescript
class AdminRegistry {
  public readonly admins: address[] = [];

  constructor(admin: address) {
    this.admins.push(admin);
  }
}
```

This compiles to an `internal` storage array with a public `getAdmins()` view function, so external callers can read the array without being able to modify it.

You can populate a readonly array in the constructor, and the generated getter returns the full array for read-only access.

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

Constructor parameters can have default values, just as in TypeScript:

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

Parameters with default values are baked into the contract at compile time, so you don't need to pass them when deploying. This keeps deployment simpler while leaving the default visible in your contract code.
