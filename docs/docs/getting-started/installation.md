---
sidebar_position: 1
title: Installation
---

# Installation

## Prerequisites

- **Node.js** 22.0 or higher
- A package manager: **npm**, **yarn** or **pnpm**

:::tip Try it online first
You can try Skittles in the [online playground](https://skittles.dev/#playground) without installing anything. Type TypeScript on the left and see the generated Solidity on the right. It runs in the browser and recompiles shortly after you stop typing.
:::

## Get Started

Scaffold a new project with the CLI. This creates configuration files, an example ERC20 token contract, a test file and a Hardhat setup, then installs dependencies with npm, yarn or pnpm:

```bash
npx skittles@latest init
```

No separate install step is needed. `npx skittles@latest` fetches the latest version and runs it directly.

## Adding to an Existing Project

To add Skittles to a project that already has a `package.json`, install it as a dependency:

```bash
npm install skittles
```

Or with pnpm:

```bash
pnpm add skittles
```

This installs the Skittles compiler, CLI and TypeScript type definitions. Because Skittles generates Solidity source, you also need a tool such as [Hardhat](https://hardhat.org) to compile to ABI and bytecode, test and deploy your contracts. Running `skittles init` sets Hardhat up for you.

## Verify Installation

After scaffolding or installing, verify the CLI is available:

```bash
npx skittles --help
```

You should see the available commands:

```
skittles <command> [options]

Commands:
  skittles compile  Compile TypeScript contracts to Solidity
  skittles clean    Remove build artifacts
  skittles init     Initialize a new Skittles project

Options:
  --help     Show help
  --version  Show version number
```

## What Gets Installed

The `skittles` package exports:

| Export | Purpose |
| --- | --- |
| `address`, `bytes`, `bytes32` | Ethereum primitive types for contract files |
| `msg`, `block`, `tx` | Blockchain context (`msg.sender`, `block.timestamp`, etc.) |
| `self` | The contract's own address (`address(this)` in Solidity) |
| `SkittlesEvent<T>`, `Event<T>` | Declare contract events |
| `SkittlesError<T>` | Declare custom errors |
| `Indexed<T>` | Mark event parameters as indexed |
| `keccak256`, `sha256`, `hash` | Built-in hash functions (`hash` is an alias for `keccak256`) |
| `ecrecover` | Recover signer address from a signature |
| `addmod`, `mulmod` | Arbitrary precision modular arithmetic |
| `gasleft` | Get remaining gas for the current transaction |
| `abi` | ABI encoding/decoding namespace |
| `Contract<T>` | Reference an external contract at an address via its interface |
| `SkittlesConfig` | Configuration type for `skittles.config.json` |

The [Hardhat](https://hardhat.org) 3 setup created by `skittles init` runs tests with Mocha, Chai matchers and ethers v6 against Hardhat's local simulated network. See the [Testing Guide](/guide/testing) for details.

The main exports are TypeScript type stubs for editor autocomplete and type checking. At compile time, Skittles reads the TypeScript AST directly, and the stubs are never executed at runtime.

## Next Steps

Continue to [Quick Start](/getting-started/quick-start) to scaffold a project and compile your first contract.
