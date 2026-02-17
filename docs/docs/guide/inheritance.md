---
sidebar_position: 6
title: Inheritance
---

# Inheritance

Skittles supports contract inheritance using TypeScript's `extends` keyword.

## Basic Inheritance

```typescript
class BaseToken {
  totalSupply: number = 0;
  private balances: Record<address, number> = {};

  balanceOf(account: address): number {
    return this.balances[account];
  }
}

class MyToken extends BaseToken {
  name: string = "My Token";

  override balanceOf(account: address): number {
    // Custom implementation
    return this.balances[account];
  }
}
```

```solidity title="Generated Solidity"
contract BaseToken {
    uint256 public totalSupply;
    mapping(address => uint256) internal balances;

    function balanceOf(address account) public view virtual returns (uint256) {
        return balances[account];
    }
}

contract MyToken is BaseToken {
    string public name = "My Token";

    function balanceOf(address account) public view override returns (uint256) {
        return balances[account];
    }
}
```

When both parent and child are in the same file, Skittles generates both contracts in a single Solidity file with the `is` keyword for inheritance.

## Virtual and Override

- All functions are `virtual` by default, allowing child contracts to override them
- Use the TypeScript `override` keyword to mark a function as overriding a parent function

```typescript
class Parent {
  // Generated as: function getValue() public view virtual returns (uint256)
  getValue(): number {
    return 42;
  }
}

class Child extends Parent {
  // Generated as: function getValue() public view override returns (uint256)
  override getValue(): number {
    return 100;
  }
}
```

## Calling Super

Use `super` to call the parent implementation:

```typescript
class Child extends Parent {
  override getValue(): number {
    let base: number = super.getValue();
    return base + 1;
  }
}
```

## Interfaces (implements)

TypeScript `implements` is accepted for type checking but does not affect the Solidity output. It is a TypeScript compile time constraint only:

```typescript title="contracts/IToken.ts"
import { address } from "skittles";

export default interface IToken {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: number;
  balanceOf(account: address): number;
  transfer(to: address, amount: number): boolean;
}
```

```typescript title="contracts/Token.ts"
import IToken from "./IToken";

export class Token implements IToken {
  // TypeScript ensures this class has all the required properties and methods
  name: string = "My Token";
  symbol: string = "MTK";
  decimals: number = 18;
  totalSupply: number = 0;
  // ...
}
```

The `implements` keyword enforces the shape at the TypeScript level (giving you IDE autocomplete and error checking), while the generated Solidity is a standard contract without any interface import.
