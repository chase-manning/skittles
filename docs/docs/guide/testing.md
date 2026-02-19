---
sidebar_position: 9
title: Testing
---

# Testing

Skittles compiles TypeScript contracts to Solidity. For compiling and testing, we recommend [Hardhat](https://hardhat.org) with its built-in test runner and the patterns described in the [Hardhat testing guide](https://hardhat.org/docs/guides/testing/using-ethers).

## How It Works

1. **Compile** with Skittles to generate Solidity in `build/solidity/`
2. **Test** with Hardhat, which compiles the generated Solidity and runs your tests against an in-memory EVM

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

- A `hardhat.config.ts` configured with the Ethers toolbox plugins (hardhat-ethers, hardhat-mocha, hardhat-ethers-chai-matchers, hardhat-network-helpers)
- `paths.sources` set to `./build/solidity` so Hardhat compiles the Solidity that Skittles generates
- A sample test file demonstrating event assertions, revert checking, and fixtures
- Scripts and dev dependencies for the full Hardhat testing workflow

## Recommended Configuration

The init template uses the configuration recommended in the [Hardhat v3 testing guide](https://hardhat.org/docs/guides/testing/using-ethers):

- **Test runner:** Mocha (via `@nomicfoundation/hardhat-mocha`)
- **Contract interactions:** ethers.js v6 (via `@nomicfoundation/hardhat-ethers`)
- **Assertions:** Chai with `hardhat-ethers-chai-matchers` (`.to.emit`, `.revertedWith`, `.revertedWithCustomError`)
- **Fixtures:** `loadFixture` from `hardhat-network-helpers` for fast test setup
- **Network:** `hre.network.connect()` for an in-memory EVM per test file

## Learn More

For detailed testing patterns, matchers, multichain support, and advanced usage, see the official Hardhat docs:

- [Testing with Ethers and Mocha](https://hardhat.org/docs/guides/testing/using-ethers)
- [Hardhat Network Helpers](https://hardhat.org/docs/plugins/hardhat-network-helpers)
- [Hardhat Ethers Chai Matchers](https://hardhat.org/docs/plugins/hardhat-ethers-chai-matchers)
