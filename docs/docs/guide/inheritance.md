---
sidebar_position: 6
title: Inheritance
---

# Inheritance

Skittles supports contract inheritance using TypeScript's `extends` keyword. Build modular, reusable contracts by extending base contracts.

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

## Virtual and Override

All methods can be overridden by child contracts by default. Use the `override` keyword when you want to replace a parent's method.

```typescript
class Parent {
  getValue(): number {
    return 42;
  }
}

class Child extends Parent {
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

## Abstract Classes

Use TypeScript's `abstract` keyword to create base contracts where some functions must be implemented by child contracts. Abstract classes compile to Solidity `abstract contract` declarations, and abstract methods become function signatures without a body.

```typescript
abstract class Ownable {
  public owner: address;

  constructor() {
    this.owner = msg.sender;
  }

  abstract getOwner(): address;
}

class Token extends Ownable {
  getOwner(): address {
    return this.owner;
  }
}
```

You can mix abstract and concrete methods in the same class:

```typescript
abstract class Base {
  public value: number = 0;

  abstract getValue(): number;

  public increment(): void {
    this.value = this.value + 1;
  }
}
```

## Interfaces (implements)

Use `implements` to ensure your contract follows a specific shape. TypeScript will check that your contract has all the required properties and methods.

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

## Cross-File Inheritance

You can extend a base contract defined in another file. Skittles automatically generates the correct Solidity `import` statement so the child contract can reference the parent.

```typescript title="contracts/BaseToken.ts"
export class BaseToken {
  public totalSupply: number = 0;
  protected balances: Record<address, number> = {};

  public balanceOf(account: address): number {
    return this.balances[account];
  }
}
```

```typescript title="contracts/ChildToken.ts"
import { BaseToken } from "./BaseToken";

export class ChildToken extends BaseToken {
  private owner: address;

  constructor() {
    super();
    this.owner = msg.sender;
  }

  public mint(to: address, amount: number): void {
    if (msg.sender !== this.owner) {
      throw new Error("Caller is not the owner");
    }
    this.balances[to] += amount;
    this.totalSupply += amount;
  }
}
```
