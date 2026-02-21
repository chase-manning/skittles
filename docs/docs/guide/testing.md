---
sidebar_position: 9
title: Testing
---

# Testing

Testing your smart contracts is essential to make sure they work correctly before deploying to a real blockchain. Skittles works with [Hardhat](https://hardhat.org), a popular development tool that lets you run tests against a local simulated blockchain.

## How It Works

1. **Compile** your TypeScript contracts with Skittles
2. **Run tests** with Hardhat against a local simulated blockchain

Your `package.json` test script should run both steps:

```json
{
  "scripts": {
    "test": "skittles compile && hardhat test"
  }
}
```

## What `skittles init` Sets Up

When you run `skittles init`, we scaffold a project that includes:

- Hardhat configured with testing tools
- A sample test file demonstrating event assertions, revert checking, and fixtures
- Scripts and dev dependencies for the full testing workflow

## Recommended Configuration

The init template uses the configuration recommended in the [Hardhat v3 testing guide](https://hardhat.org/docs/guides/testing/using-ethers):

- **Test runner:** Mocha for organizing and running your tests
- **Contract interactions:** ethers.js v6 for interacting with your contracts
- **Assertions:** Chai matchers for checking events, reverts, and custom errors
- **Fixtures:** Fast test setup that saves time when running multiple tests

## Learn More

For detailed testing patterns, matchers, multichain support, and advanced usage, see the official Hardhat docs:

- [Testing with Ethers and Mocha](https://hardhat.org/docs/guides/testing/using-ethers)
- [Hardhat Network Helpers](https://hardhat.org/docs/plugins/hardhat-network-helpers)
- [Hardhat Ethers Chai Matchers](https://hardhat.org/docs/plugins/hardhat-ethers-chai-matchers)
