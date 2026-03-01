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
import { ERC20 } from "skittles/contracts";

export class Token extends ERC20 {
  private _owner: address;

  constructor(initialSupply: number) {
    super("MyToken", "MTK");
    this._owner = msg.sender;
    this._mint(msg.sender, initialSupply);
  }

  public mint(to: address, amount: number): void {
    if (msg.sender != this._owner) {
      throw new Error("Caller is not the owner");
    }
    this._mint(to, amount);
  }
}
```

This creates a mintable ERC20 token by extending the built-in `ERC20` contract from the [standard library](/guide/standard-library). You get a full token (name, symbol, decimals, transfers, approvals) from just a few lines of code. The constructor sets the initial supply and an owner for the mint function.

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

- [Standard Library](/guide/standard-library) for ERC20, ERC721, Ownable, and more
- [Type System](/guide/types) to learn what TypeScript features you can use
- [State Variables](/guide/state-variables) for visibility, constants, and immutables
- [Functions](/guide/functions) for mutability inference, receive/fallback, and more
- [Configuration](/guide/configuration) to customize the compiler
