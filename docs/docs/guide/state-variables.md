---
sidebar_position: 2
title: State Variables
---

# State Variables

Class properties compile to Solidity state variables. Visibility, mutability, and initial values are all controlled through standard TypeScript syntax.

## Visibility

TypeScript access modifiers map to Solidity visibility:

| TypeScript                | Solidity   | Notes                                                |
| ------------------------- | ---------- | ---------------------------------------------------- |
| `public` (or no modifier) | `public`   | Generates an automatic getter                        |
| `private`                 | `internal` | Accessible within the contract and derived contracts |
| `protected`               | `internal` | Same as `private` in Solidity output                 |

```typescript
class Token {
  public name: string = "MyToken"; // string public name = "MyToken";
  public totalSupply: number = 0; // uint256 public totalSupply;
  private balances: Record<address, number> = {}; // mapping(address => uint256) internal balances;
}
```

:::info
Skittles maps TypeScript `private` to Solidity `internal` rather than Solidity `private`. This is intentional: Solidity's `internal` is more gas efficient and allows derived contracts to access the variable, which aligns with typical usage patterns.
:::

## Initial Values

Properties with initializers generate Solidity state variables with default values:

```typescript
class Token {
  name: string = "MyToken"; // string public name = "MyToken";
  decimals: number = 18; // uint256 public decimals = 18;
  paused: boolean = false; // bool public paused = false;
}
```

Mappings and arrays do not get initializers in Solidity (they are initialized to empty by default):

```typescript
class Token {
  balances: Record<address, number> = {}; // mapping(address => uint256) public balances;
  owners: address[] = []; // address[] public owners;
}
```

## Constants

Use `static readonly` for compile time constants:

```typescript
class Staking {
  static readonly FEE_BASIS_POINTS: number = 50;
  static readonly BASIS_POINTS_DENOMINATOR: number = 10000;
}
```

```solidity title="Generated Solidity"
uint256 public constant FEE_BASIS_POINTS = 50;
uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;
```

Reference constants using the class name:

```typescript
let fee: number =
  (amount * Staking.FEE_BASIS_POINTS) / Staking.BASIS_POINTS_DENOMINATOR;
```

## Immutables

Use `readonly` (without `static`) for immutable variables. These can only be set in the constructor:

```typescript
class Staking {
  readonly owner: address = msg.sender;
}
```

```solidity title="Generated Solidity"
address public immutable owner;
```

:::note
The `immutable` modifier is only applied to value types (`uint256`, `address`, `bool`, `bytes32`). Reference types like `string` cannot be `immutable` in Solidity, so `readonly` on a `string` property produces a regular state variable.
:::

## Constructor

Use a standard TypeScript constructor to initialize state:

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

```solidity title="Generated Solidity"
constructor(uint256 initialSupply) {
    totalSupply = initialSupply;
    balances[msg.sender] = initialSupply;
}
```

Constructor parameters follow the same type rules as function parameters.
