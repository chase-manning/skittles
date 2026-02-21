---
sidebar_position: 2
title: Quick Start
---

# Quick Start

Get a working Skittles project in two commands.

## Scaffold a Project

Run the init command to create a project structure with an example contract:

```bash
npx skittles@latest init
```

This creates the following files:

```
your-project/
├── contracts/
│   └── Token.ts           # Example ERC20 token contract
├── test/
│   └── Token.test.ts      # Example test using Hardhat + Mocha
├── skittles.config.json   # Compiler configuration
├── tsconfig.json          # TypeScript configuration
└── hardhat.config.ts      # Hardhat config with Ethers toolbox
```

It also updates your `.gitignore` to exclude `build/`, `dist/`, and `node_modules/`.

## Write a Contract

Open `contracts/Token.ts` to see the generated example:

```typescript title="contracts/Token.ts"
import { address, msg } from "skittles";

export class Token {
  public name: string = "MyToken";
  public symbol: string = "MTK";
  public totalSupply: number = 0;
  private balances: Record<address, number> = {};

  constructor(initialSupply: number) {
    this.totalSupply = initialSupply;
    this.balances[msg.sender] = initialSupply;
  }

  public balanceOf(account: address): number {
    return this.balances[account];
  }

  public transfer(to: address, amount: number): boolean {
    const sender: address = msg.sender;
    if (this.balances[sender] < amount) {
      throw new Error("Insufficient balance");
    }
    this.balances[sender] -= amount;
    this.balances[to] += amount;
    return true;
  }
}
```

This creates a simple token contract where users can check their balance and transfer tokens to other addresses. The constructor creates an initial supply and assigns it to the contract deployer.

## Compile

Run the compiler to build your contracts:

```bash
npx skittles compile
```

Output:

```
🍬 Skittles

ℹ Found 1 contract file(s)
ℹ Compiling contracts/Token.ts...
✔ Token compiled successfully
✔ Compilation complete
✔ 1 contract(s) compiled successfully
```

This builds your contracts so they're ready for testing and deployment.

## Testing

Run your tests with:

```bash
npm run test
```

This compiles your contracts and runs the test suite against a local blockchain.

See the [Testing Guide](/guide/testing) for more details on writing tests.

## Next Steps

- [Type System](/guide/types) to learn what TypeScript features you can use
- [State Variables](/guide/state-variables) for visibility, constants, and immutables
- [Functions](/guide/functions) for mutability inference, receive/fallback, and more
- [Configuration](/guide/configuration) to customize the compiler
