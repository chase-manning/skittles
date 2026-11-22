---
sidebar_position: 11
title: Debugging
---

# Debugging

Skittles supports `console.log()` for debugging your contracts during development. It maps directly to [Hardhat's console.log](https://hardhat.org/hardhat-network/docs/reference#console.log).

## Setup

Enable console.log support in your config (projects scaffolded with Skittles have this enabled by default):

```json title="skittles.config.json"
{
  "consoleLog": true
}
```

## Usage

Use `console.log()` in your contracts just as you would in TypeScript:

```typescript title="contracts/Token.ts"
class Token {
  private balances: Record<address, number> = {};

  public transfer(to: address, amount: number): boolean {
    console.log("Transfer called by", msg.sender);
    console.log("Amount:", amount);

    if (this.balances[msg.sender] < amount) {
      console.log("Insufficient balance");
      throw new Error("Insufficient balance");
    }

    this.balances[msg.sender] -= amount;
    this.balances[to] += amount;
    return true;
  }
}
```

This compiles to Solidity with Hardhat's console import:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";

contract Token {
    mapping(address => uint256) internal balances;

    function transfer(address to, uint256 amount) public returns (bool) {
        console.log("Transfer called by", msg.sender);
        console.log("Amount:", amount);
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[to] += amount;
        return true;
    }
}
```

## Supported Arguments

You can pass strings, numbers, booleans and addresses to `console.log()`:

```typescript
console.log("hello");
console.log("balance:", amount);
console.log("sender:", msg.sender);
```

## Production Builds

The `consoleLog` option defaults to `false`. When it is disabled, any `console.log()` calls in your contracts are removed from the compiled Solidity output. You can leave debug logs in your source code during development and they will be removed in production builds.

To enable console.log output during development:

```json title="skittles.config.json"
{
  "consoleLog": true
}
```

When you're ready to deploy, set `consoleLog` to `false` (or remove it) and recompile. All `console.log()` calls will be stripped from the compiled output.
