---
sidebar_position: 2
title: Quick Start
---

# Quick Start

Get a working Skittles project in three commands.

## Scaffold a Project

Run the init command to create a project structure with an example contract:

```bash
npx skittles init
```

This creates the following files:

```
your-project/
├── contracts/
│   └── Token.ts           # Example ERC20 token contract
├── test/
│   └── Token.test.ts      # Example test using skittles/testing
├── skittles.config.json   # Compiler configuration
├── tsconfig.json          # TypeScript configuration
├── vitest.config.ts       # Test runner configuration
└── hardhat.config.ts      # In memory EVM configuration
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

## Compile

Run the compiler:

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

## Inspect the Output

The compiler produces three artifacts for each contract:

```bash
cat build/solidity/Token.sol    # Human readable Solidity
cat build/abi/Token.json        # Contract ABI (JSON)
cat build/bytecode/Token.bin    # EVM bytecode (hex)
```

Here is the generated Solidity for the example above:

```solidity title="build/solidity/Token.sol"
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Token {
    string public name = "MyToken";
    string public symbol = "MTK";
    uint256 public totalSupply;
    mapping(address => uint256) internal balances;

    constructor(uint256 initialSupply) {
        totalSupply = initialSupply;
        balances[msg.sender] = initialSupply;
    }

    function balanceOf(address account) public view virtual returns (uint256) {
        return balances[account];
    }

    function transfer(address to, uint256 amount) public virtual returns (bool) {
        address sender = msg.sender;
        require(balances[sender] >= amount, "Insufficient balance");
        balances[sender] -= amount;
        balances[to] += amount;
        return true;
    }
}
```

Notice what Skittles did automatically:

- `number` became `uint256`, `string` stayed `string`, `Record<address, number>` became `mapping(address => uint256)`
- `private` became `internal` (Solidity convention for gas efficiency)
- `balanceOf` was marked `view` because it only reads state
- The `if/throw` pattern was optimized to `require()`
- Memory annotations (`memory` for strings) were added where needed
- Functions were marked `virtual` by default for extensibility

## Testing

Skittles includes built in testing utilities. Install the testing dependencies:

```bash
npm install --save-dev ethers hardhat vitest
```

The `skittles init` command scaffolds a test file at `test/Token.test.ts`, a `vitest.config.ts`, and a `hardhat.config.ts`. Run your tests with a single command:

```bash
npx skittles test
```

This compiles your contracts and runs the test suite automatically. No separate compile step needed.

See the [Testing Guide](/guide/testing) for a full walkthrough.

## Next Steps

- [Type System](/guide/types) to learn how TypeScript types map to Solidity
- [State Variables](/guide/state-variables) for visibility, constants, and immutables
- [Functions](/guide/functions) for mutability inference, receive/fallback, and more
- [Configuration](/guide/configuration) to customize the compiler
