---
sidebar_position: 11
title: Debugging
---

# Debugging

Skittles supports `console.log()` for debugging your contracts during development. It works just like in regular TypeScript — use it to print values and trace execution in your contract functions.

## Usage

Use `console.log()` anywhere in your contract methods:

```typescript
class Token {
  balances: Record<address, number> = {};

  transfer(to: address, amount: number): boolean {
    console.log("transfer called");
    console.log(msg.sender);
    console.log(amount);

    this.balances[msg.sender] -= amount;
    this.balances[to] += amount;
    return true;
  }
}
```

## How It Works

Skittles compiles `console.log()` to [Hardhat's `console.log`](https://hardhat.org/docs/guides/testing/logging). When your contract uses `console.log`, the generated Solidity will automatically include the `import "hardhat/console.sol";` import.

Log output appears in your terminal when running tests with Hardhat.

## Supported Argument Types

You can log the same types you use in your contracts:

| Type      | Example                          |
| --------- | -------------------------------- |
| `string`  | `console.log("hello")`          |
| `number`  | `console.log(amount)`           |
| `boolean` | `console.log(isActive)`         |
| `address` | `console.log(msg.sender)`       |

You can also pass multiple arguments:

```typescript
console.log("balance:", this.balances[msg.sender]);
```

## Production Builds

`console.log` is designed for development and testing only. Log calls have no effect when your contract is deployed to a live network, but they do increase the contract's bytecode size. Remove `console.log` calls before deploying to production to optimize gas costs.
