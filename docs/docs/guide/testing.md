---
sidebar_position: 9
title: Testing
---

# Testing

Skittles ships built in testing utilities so you can test your contracts with zero boilerplate. Call `setup()` from `skittles/testing` and you get an in memory EVM, pre-funded accounts, and deploy/utility functions, all with automatic lifecycle management.

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

Import `setup` from `skittles/testing` and call it inside a `describe` block. It automatically creates an in memory EVM before your tests run and shuts it down afterwards:

```typescript title="test/Token.test.ts"
import { describe, it, expect, beforeAll } from "vitest";
import { setup } from "skittles/testing";

const INITIAL_SUPPLY = 1_000_000n;

describe("Token", () => {
  const env = setup();
  let token: any;

  beforeAll(async () => {
    token = await env.deploy("Token", [INITIAL_SUPPLY]);
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
    const aliceToken = env.connectAs(token, alice);

    await expect(
      aliceToken.transfer(bobAddr, 999_999_999n)
    ).rejects.toThrow();
  });
});
```

That's it. No helpers file, no manual EVM setup, no afterAll cleanup.

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

### `setup()`

The recommended way to create a test environment. Call it inside a `describe` block and it automatically registers `beforeAll`/`afterAll` hooks to start and stop the in memory EVM.

Returns a `SkittlesTestContext` with:

| Property     | Type                                              | Description                                |
| ------------ | ------------------------------------------------- | ------------------------------------------ |
| `accounts`   | `Signer[]`                                        | Ten pre-funded signer accounts             |
| `provider`   | `JsonRpcProvider`                                  | ethers.js JSON RPC provider                |
| `deploy`     | `(name, args?, opts?) => Promise<Contract>`        | Deploy a compiled contract                 |
| `connectAs`  | `(contract, signer) => Contract`                   | Connect as a different signer              |
| `getBalance` | `(address) => Promise<bigint>`                     | Get ETH balance of an address              |

Access `accounts` and `provider` inside lifecycle hooks or test blocks (after `beforeAll` has run). Functions like `deploy`, `connectAs`, and `getBalance` can be called any time after `beforeAll`.

The `deploy` function automatically loads ABI and bytecode from the `build/` directory. Options:

| Option       | Type       | Description                              |
| ------------ | ---------- | ---------------------------------------- |
| `buildDir`   | `string`   | Override build directory                 |
| `value`      | `bigint`   | ETH to send (payable constructors)       |
| `from`       | `number`   | Account index to deploy from (default 0) |

### `env.connectAs(contract, signer)`

Returns a new contract instance connected to a different signer. Use this to test multi account scenarios:

```typescript
const [, alice] = env.accounts;
const aliceToken = env.connectAs(token, alice);
await aliceToken.transfer(bobAddr, 100n);
```

### `env.getBalance(address)`

Returns the ETH balance of an address as a `bigint`:

```typescript
const balance = await env.getBalance(aliceAddr);
```

## Testing Payable Functions

Send ETH with deployment or function calls:

```typescript
const env = setup();

// Payable constructor (inside beforeAll)
const vault = await env.deploy("Staking", [], { value: ethers.parseEther("1") });

// Payable function
const aliceVault = env.connectAs(vault, env.accounts[1]);
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

## Advanced: Manual Lifecycle

If you need more control (e.g., multiple environments in one file, or custom lifecycle timing), you can use the lower level API directly. Note that Vitest is still required since `skittles/testing` imports it at module load time:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestEnv, deploy, connectAs, TestEnv } from "skittles/testing";

describe("Token", () => {
  let env: TestEnv;
  let token: any;

  beforeAll(async () => {
    env = await createTestEnv();
    token = await deploy(env, "Token", [1_000_000n]);
  });

  afterAll(async () => {
    await env.close();
  });

  it("works", async () => {
    expect(await token.name()).toBe("MyToken");
  });
});
```

The standalone `deploy(env, name, args, options)` and `getBalance(env, address)` functions take a `TestEnv` as the first argument instead of using the automatic context.

## Working Example

The [example project](https://github.com/chase-manning/skittles/tree/main/example) contains a full test suite for an ERC20 token and a staking contract.

```bash
git clone https://github.com/chase-manning/skittles.git
cd skittles/example
yarn install
yarn test
```
