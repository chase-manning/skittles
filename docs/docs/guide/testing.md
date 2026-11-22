---
sidebar_position: 9
title: Testing
---

# Testing

Skittles works with [Hardhat](https://hardhat.org) to run tests against a local simulated network before you deploy to a live blockchain.

## How It Works

1. **Compile** your TypeScript contracts with Skittles
2. **Run tests** with Hardhat against Hardhat's local simulated network

Your `package.json` test script runs both steps:

```json
{
  "scripts": {
    "test": "skittles compile && hardhat test"
  }
}
```

## What `skittles init` Sets Up

Running `skittles init` scaffolds a project that includes:

- Hardhat configured for testing
- A sample test file with 4 tests (token name, initial supply to the deployer, Transfer event and owner mint), using a fixture and an event assertion
- Package scripts and dev dependencies for compiling and running tests

## Recommended Configuration

The init template uses the configuration from the [Hardhat v3 testing guide](https://hardhat.org/docs/guides/testing/using-ethers):

- **Test runner:** Mocha for organising and running tests
- **Contract interactions:** ethers.js v6 for interacting with your contracts
- **Assertions:** Chai matchers for checking events, reverts and custom errors
- **Fixtures:** Fast test setup that saves time when running multiple tests

## Common Testing Patterns

Below are common testing patterns for smart contracts. All examples assume you have a fixture like this:

```typescript
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-ethers-chai-matchers";
import "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers, networkHelpers } = await hre.network.connect();

async function deployFixture() {
  const contract = await ethers.deployContract("Staking");
  const [owner, alice, bob] = await ethers.getSigners();
  return { contract, owner, alice, bob };
}
```

### Testing Payable Functions

To send ETH when calling a function, pass a `value` option:

```typescript
it("accepts ETH deposits", async function () {
  const { contract, alice } = await networkHelpers.loadFixture(deployFixture);
  const addr = await contract.getAddress();
  const contractAsAlice = await ethers.getContractAt("Staking", addr, alice);

  await contractAsAlice.deposit({ value: ethers.parseEther("1.0") });

  expect(await contract.getDeposit(alice.address)).to.equal(
    ethers.parseEther("1.0")
  );
});
```

### Testing ETH Balance Changes

Use `ethers.provider.getBalance` to check how a contract's or account's ETH balance changes after a transaction:

```typescript
it("tracks contract ETH balance on deposit", async function () {
  const { contract, alice } = await networkHelpers.loadFixture(deployFixture);
  const addr = await contract.getAddress();
  const contractAsAlice = await ethers.getContractAt("Staking", addr, alice);

  const balBefore = await ethers.provider.getBalance(addr);
  await contractAsAlice.deposit({ value: ethers.parseEther("1.0") });
  const balAfter = await ethers.provider.getBalance(addr);

  expect(balAfter - balBefore).to.equal(ethers.parseEther("1.0"));
});
```

### Testing Custom Errors

Use `revertedWithCustomError` to assert that a transaction reverts with a custom error declared in your contract:

```typescript
it("reverts with custom error", async function () {
  const { contract, alice } = await networkHelpers.loadFixture(deployFixture);
  const addr = await contract.getAddress();
  const contractAsAlice = await ethers.getContractAt("Staking", addr, alice);

  await expect(
    contractAsAlice.withdraw(ethers.parseEther("999"))
  ).to.be.revertedWithCustomError(contract, "InsufficientDeposit");
});
```

For string error messages, use `revertedWith`:

```typescript
it("reverts with message", async function () {
  const { contract, alice } = await networkHelpers.loadFixture(deployFixture);
  const addr = await contract.getAddress();
  const contractAsAlice = await ethers.getContractAt("Staking", addr, alice);

  await expect(
    contractAsAlice.deposit({ value: 0 })
  ).to.be.revertedWith("Must send ETH");
});
```

### Testing with Different Signers

Use `ethers.getContractAt` with a different signer to call contract functions as another account. This is useful for testing access control:

```typescript
it("only allows owner to pause", async function () {
  const { contract, alice } = await networkHelpers.loadFixture(deployFixture);
  const addr = await contract.getAddress();
  const contractAsAlice = await ethers.getContractAt("Staking", addr, alice);

  await expect(
    contractAsAlice.pause()
  ).to.be.revertedWithCustomError(contract, "NotOwner");
});
```

## Learn More

For more testing patterns, matchers, multichain support and advanced usage, see the Hardhat docs:

- [Testing with Ethers and Mocha](https://hardhat.org/docs/guides/testing/using-ethers)
- [Hardhat Network Helpers](https://hardhat.org/docs/plugins/hardhat-network-helpers)
- [Hardhat Ethers Chai Matchers](https://hardhat.org/docs/plugins/hardhat-ethers-chai-matchers)
