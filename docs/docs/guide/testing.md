---
sidebar_position: 9
title: Testing
---

# Testing

Skittles ships built in testing utilities so you can test your contracts with zero boilerplate. The `skittles/testing` module provides everything you need: an in memory EVM, contract deployment, and account helpers.

## Quick Setup

If you scaffolded your project with `skittles init`, you already have a working test file and config. Otherwise, install the testing dependencies:

```bash
npm install --save-dev ethers hardhat vitest
```

Create a `vitest.config.ts`:

```typescript title="vitest.config.ts"
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 30000,
  },
});
```

Create a `hardhat.config.ts`:

```typescript title="hardhat.config.ts"
import { defineConfig } from "hardhat/config";

export default defineConfig({});
```

## Writing Tests

Import the helpers from `skittles/testing` and write your tests with Vitest:

```typescript title="test/Token.test.ts"
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestEnv, deploy, connectAs, TestEnv } from "skittles/testing";

const INITIAL_SUPPLY = 1_000_000n;

describe("Token", () => {
  let env: TestEnv;
  let token: any;

  beforeAll(async () => {
    env = await createTestEnv();
    token = await deploy(env, "Token", [INITIAL_SUPPLY]);
  });

  afterAll(async () => {
    await env.close();
  });

  it("has the correct name", async () => {
    expect(await token.name()).toBe("MyToken");
  });

  it("assigns initial supply to the deployer", async () => {
    const [deployer] = env.accounts;
    const balance = await token.balanceOf(await deployer.getAddress());
    expect(balance).toBe(INITIAL_SUPPLY);
  });

  it("transfers tokens between accounts", async () => {
    const [, alice] = env.accounts;
    const aliceAddr = await alice.getAddress();

    await token.transfer(aliceAddr, 100n);
    expect(await token.balanceOf(aliceAddr)).toBe(100n);
  });

  it("reverts on insufficient balance", async () => {
    const [, alice, bob] = env.accounts;
    const bobAddr = await bob.getAddress();
    const aliceToken = connectAs(token, alice);

    await expect(
      aliceToken.transfer(bobAddr, 999_999_999n)
    ).rejects.toThrow();
  });
});
```

That's it. No helpers file, no manual artifact loading, no EVM configuration.

## Running Tests

Use the built in test command, which compiles your contracts and then runs vitest:

```bash
npx skittles test
```

Or in watch mode:

```bash
npx skittles test --watch
```

Add these as scripts in your `package.json`:

```json
{
  "scripts": {
    "test": "skittles test",
    "test:watch": "skittles test --watch"
  }
}
```

## API Reference

### `createTestEnv()`

Creates a fresh in memory EVM backed by Hardhat's EDR runtime. Returns a `TestEnv` with:

| Property   | Type                | Description                        |
| ---------- | ------------------- | ---------------------------------- |
| `provider` | `JsonRpcProvider`   | ethers.js JSON RPC provider        |
| `accounts` | `Signer[]`          | Ten pre funded signer accounts     |
| `close`    | `() => Promise`     | Shut down the in memory EVM        |

Call `createTestEnv()` in `beforeAll` and `env.close()` in `afterAll`.

### `deploy(env, contractName, constructorArgs?, options?)`

Deploys a compiled contract to the test EVM. Automatically loads the ABI and bytecode from the `build/` directory.

| Parameter         | Type       | Description                              |
| ----------------- | ---------- | ---------------------------------------- |
| `env`             | `TestEnv`  | The test environment                     |
| `contractName`    | `string`   | Name of the contract (matches filename)  |
| `constructorArgs` | `any[]`    | Constructor arguments (default `[]`)     |
| `options.buildDir`| `string`   | Override build directory                 |
| `options.value`   | `bigint`   | ETH to send (payable constructors)       |
| `options.from`    | `number`   | Account index to deploy from (default 0) |

Returns an `ethers.Contract` instance connected to the deployer.

### `connectAs(contract, signer)`

Returns a new contract instance connected to a different signer. Use this to test multi account scenarios:

```typescript
const [, alice] = env.accounts;
const aliceToken = connectAs(token, alice);
await aliceToken.transfer(bobAddr, 100n);
```

### `getBalance(env, address)`

Returns the ETH balance of an address as a `bigint`:

```typescript
const balance = await getBalance(env, aliceAddr);
```

### `loadArtifact(contractName, buildDir?)`

Loads a compiled contract's ABI and bytecode from disk. You typically don't need this directly since `deploy()` calls it internally, but it's available for advanced use cases:

```typescript
const { abi, bytecode } = loadArtifact("Token");
```

## Testing Payable Functions

Send ETH with deployment or function calls:

```typescript
// Payable constructor
const vault = await deploy(env, "Staking", [], { value: ethers.parseEther("1") });

// Payable function
const aliceVault = connectAs(vault, env.accounts[1]);
await aliceVault.deposit({ value: ethers.parseEther("1") });
```

## Testing Events

Parse events from transaction receipts using the contract interface:

```typescript
const tx = await token.transfer(aliceAddr, 100n);
const receipt = await tx.wait();

const iface = token.interface;
const log = receipt.logs.find(
  (l) => iface.parseLog(l)?.name === "Transfer"
);

expect(log).toBeTruthy();
const parsed = iface.parseLog(log!);
expect(parsed!.args[0]).toBe(ownerAddr);
expect(parsed!.args[1]).toBe(aliceAddr);
expect(parsed!.args[2]).toBe(100n);
```

## Testing Reverts

Use Vitest's `rejects.toThrow()` matcher:

```typescript
await expect(
  token.transfer(aliceAddr, 999_999_999n)
).rejects.toThrow();
```

## Working Example

The [example project](https://github.com/chase-manning/skittles/tree/main/example) contains a full test suite for an ERC20 token and a staking contract.

```bash
git clone https://github.com/chase-manning/skittles.git
cd skittles/example
yarn install
yarn test
```
