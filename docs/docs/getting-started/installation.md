---
sidebar_position: 1
title: Installation
---

# Installation

## Prerequisites

- **Node.js** 22.0 or higher
- A package manager: **npm**, **yarn**, or **pnpm**

:::tip Try it online first
Want to try Skittles without installing anything? Use the [online playground](https://skittles.dev/#playground) to write TypeScript contracts and see the generated Solidity in real-time.
:::

## Get Started

The fastest way to get started is to scaffold a new project. This downloads the compiler, creates an example contract, installs dependencies, and sets up Hardhat for you:

```bash
npx skittles@latest init
```

No separate install step is needed. `npx skittles@latest` fetches the latest version and runs it directly.

## Adding to an Existing Project

If you want to add Skittles to a project that already has a `package.json`, you can install it as a dependency:

```bash
npm install skittles
```

Or with pnpm:

```bash
pnpm add skittles
```

This installs the Skittles compiler, CLI, and TypeScript type definitions. For testing and deploying your contracts, use [Hardhat](https://hardhat.org); `skittles init` sets this up for you.

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

The `skittles` package provides:

| Export                             | Purpose                                                    |
| ---------------------------------- | ---------------------------------------------------------- |
| `address`, `bytes`, `bytes32`      | Ethereum primitive types for contract files                |
| `msg`, `block`, `tx`               | Blockchain context (`msg.sender`, `block.timestamp`, etc.) |
| `self`                             | The contract's own address (`address(this)` in Solidity)   |
| `SkittlesEvent<T>`, `Event<T>`     | Declare contract events                                    |
| `SkittlesError<T>`                 | Declare custom errors                                      |
| `Indexed<T>`                       | Mark event parameters as indexed                           |
| `keccak256`, `sha256`, `hash`      | Built-in hash functions (`hash` is an alias for `keccak256`) |
| `ecrecover`                        | Recover signer address from a signature                    |
| `addmod`, `mulmod`                 | Arbitrary precision modular arithmetic                     |
| `gasleft`                          | Get remaining gas for the current transaction              |
| `abi`                              | ABI encoding/decoding namespace                            |
| `Contract<T>`                      | Reference an external contract at an address via its interface |
| `SkittlesConfig`                   | Configuration type for `skittles.config.json`              |

For testing compiled contracts, use [Hardhat](https://hardhat.org) with the setup created by `skittles init`. See the [Testing Guide](/guide/testing) for details.

The main exports are TypeScript type stubs that provide IDE support (autocomplete, type checking). At compile time, Skittles reads the TypeScript AST directly; the stubs are never executed at runtime.

## Next Steps

Continue to [Quick Start](/getting-started/quick-start) to scaffold a project and compile your first contract.
