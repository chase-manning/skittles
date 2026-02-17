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

This installs the Skittles compiler, CLI, and TypeScript type definitions. The `solc` Solidity compiler is bundled as a dependency, so you do not need to install it separately.

## Verify Installation

After installing, verify the CLI is available:

```bash
npx skittles --help
```

You should see the available commands:

```
skittles <command> [options]

Commands:
  skittles compile  Compile TypeScript contracts to EVM bytecode
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

These are TypeScript type stubs that provide IDE support (autocomplete, type checking). At compile time, Skittles reads the TypeScript AST directly; the stubs are never executed at runtime.

## Next Steps

Continue to [Quick Start](/getting-started/quick-start) to scaffold a project and compile your first contract.
