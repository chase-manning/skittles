---
sidebar_position: 1
title: Installation
---

# Installation

## Prerequisites

- **Node.js** 20.0 or higher
- A package manager: **npm**, **yarn**, or **pnpm**

## Install the Package

```bash
npm install skittles
```

Or with yarn:

```bash
yarn add skittles
```

Or with pnpm:

```bash
pnpm add skittles
```

This installs the Skittles compiler, CLI, and TypeScript type definitions. For compiling the generated Solidity to EVM bytecode, use [Hardhat](https://hardhat.org); `skittles init` sets this up for you.

## Verify Installation

After installing, verify the CLI is available:

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
| `address`, `bytes`                 | Ethereum primitive types for contract files                |
| `msg`, `block`, `tx`               | EVM global objects (`msg.sender`, `block.timestamp`, etc.) |
| `SkittlesEvent<T>`                 | Declare Solidity events                                    |
| `SkittlesError<T>`                 | Declare Solidity custom errors                             |
| `Indexed<T>`                       | Mark event parameters as indexed                           |
| `keccak256`, `sha256`, `ecrecover` | Solidity built in function stubs                           |
| `abi`                              | ABI encoding/decoding namespace                            |
| `SkittlesConfig`                   | Configuration type for `skittles.config.json`              |

For testing compiled contracts, use [Hardhat](https://hardhat.org) with the setup created by `skittles init`. See the [Testing Guide](/guide/testing) for details.

The main exports are TypeScript type stubs that provide IDE support (autocomplete, type checking). At compile time, Skittles reads the TypeScript AST directly; the stubs are never executed at runtime.

## Next Steps

Continue to [Quick Start](/getting-started/quick-start) to scaffold a project and compile your first contract.
