---
sidebar_position: 9
title: Testing
---

# Testing

Skittles outputs standard Solidity artifacts (ABI + bytecode), so you can test with any EVM testing framework. This guide covers the recommended setup using Hardhat, ethers.js, and Vitest.

## Recommended Stack

| Tool                                  | Purpose                             |
| ------------------------------------- | ----------------------------------- |
| [Hardhat](https://hardhat.org/)       | In memory EVM for testing (EDR)     |
| [ethers.js](https://docs.ethers.org/) | Contract interaction and deployment |
| [Vitest](https://vitest.dev/)         | Test runner                         |

## Project Setup

Install the testing dependencies:

```bash
npm install --save-dev hardhat ethers vitest
```

Create a `hardhat.config.ts`:

```typescript title="hardhat.config.ts"
import { defineConfig } from "hardhat/config";

export default defineConfig({});
```

Create a `vitest.config.ts`:

```typescript title="vitest.config.ts"
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30000,
  },
});
```

## Writing Tests

Here is a complete test for an ERC20 token contract:

```typescript title="test/Token.test.ts"
import { describe, it, expect, beforeEach } from "vitest";
import { createWalletClient, http, getContract } from "viem";
// Or using ethers.js:
import { ethers } from "ethers";
import hre from "hardhat";
import fs from "fs";

// Load compiled artifacts
const abi = JSON.parse(fs.readFileSync("build/abi/Token.json", "utf-8"));
const bytecode = fs.readFileSync("build/bytecode/Token.bin", "utf-8");

describe("Token", () => {
  let provider: ethers.Provider;
  let deployer: ethers.Signer;
  let user: ethers.Signer;
  let token: ethers.Contract;

  const INITIAL_SUPPLY = 1000000n;

  beforeEach(async () => {
    // Create an in-memory Hardhat network
    const networkConfig = await hre.network.connect();
    provider = new ethers.BrowserProvider(networkConfig.provider);

    const signers = await provider.listAccounts();
    deployer = await provider.getSigner(signers[0].address);
    user = await provider.getSigner(signers[1].address);

    // Deploy the contract
    const factory = new ethers.ContractFactory(abi, bytecode, deployer);
    token = await factory.deploy(INITIAL_SUPPLY);
  });

  it("sets the correct name and symbol", async () => {
    expect(await token.name()).toBe("Skittles Token");
    expect(await token.symbol()).toBe("SKT");
  });

  it("assigns initial supply to deployer", async () => {
    const deployerAddress = await deployer.getAddress();
    expect(await token.balanceOf(deployerAddress)).toBe(INITIAL_SUPPLY);
    expect(await token.totalSupply()).toBe(INITIAL_SUPPLY);
  });

  it("transfers tokens between accounts", async () => {
    const userAddress = await user.getAddress();
    await token.transfer(userAddress, 100n);
    expect(await token.balanceOf(userAddress)).toBe(100n);
  });

  it("reverts on insufficient balance", async () => {
    const userToken = token.connect(user);
    const deployerAddress = await deployer.getAddress();
    await expect(userToken.transfer(deployerAddress, 100n)).rejects.toThrow();
  });
});
```

## Running Tests

Compile your contracts first, then run the tests:

```bash
npx skittles compile
npx vitest run
```

Or add scripts to your `package.json`:

```json
{
  "scripts": {
    "compile": "skittles compile",
    "test": "skittles compile && vitest run",
    "test:watch": "vitest"
  }
}
```

## Reading Artifacts

The compiled artifacts are plain files you read from disk:

```typescript
import fs from "fs";

// ABI (JSON)
const abi = JSON.parse(fs.readFileSync("build/abi/Token.json", "utf-8"));

// Bytecode (hex string)
const bytecode = fs.readFileSync("build/bytecode/Token.bin", "utf-8");

// Generated Solidity source (for inspection)
const solidity = fs.readFileSync("build/solidity/Token.sol", "utf-8");
```

## Working Example

The [example project](https://github.com/chase-manning/skittles/tree/main/example) in the Skittles repository contains a full working test suite with:

- An ERC20 token with transfers, approvals, and custom errors
- A staking contract with deposits, withdrawals, and admin functions
- Shared types (structs and enums) across contract files
- Tests for all major functionality

Clone and run it:

```bash
git clone https://github.com/chase-manning/skittles.git
cd skittles/example
yarn install
yarn compile
yarn test
```
