---
sidebar_position: 1
title: CLI Reference
---

# CLI Reference

The Skittles CLI provides three commands for managing your contract compilation workflow.

```bash
skittles <command> [options]
```

## compile

Compile all TypeScript contract files to Solidity, ABI, and EVM bytecode.

```bash
npx skittles compile
```

This command:

1. Loads the configuration from `skittles.config.json` or `skittles.config.js`
2. Finds all `.ts` files in the configured `contractsDir` (default: `contracts/`)
3. Pre scans files to collect shared types, functions, and constants
4. Parses each file's TypeScript AST into the Skittles intermediate representation
5. Generates Solidity source code from the IR
6. Compiles the Solidity via `solc` to produce ABI and bytecode
7. Writes artifacts to the configured `outputDir` (default: `build/`)

Output structure:

```
build/
├── abi/
│   ├── Token.json       # Contract ABI
│   └── Staking.json
├── bytecode/
│   ├── Token.bin        # EVM bytecode (hex)
│   └── Staking.bin
├── solidity/
│   ├── Token.sol        # Generated Solidity source
│   └── Staking.sol
└── .skittles-cache.json  # Incremental compilation cache
```

Incremental compilation is automatic. Unchanged files are skipped using SHA256 hash comparison.

### Example Output

```
🍬 Skittles

ℹ Found 2 contract file(s)
ℹ Compiling contracts/Token.ts...
✔ Token compiled successfully
ℹ contracts/Staking.ts unchanged, using cache
✔ Staking compiled successfully (cached)
✔ Compilation complete
✔ 2 contract(s) compiled successfully
```

## clean

Remove all build artifacts and the compilation cache.

```bash
npx skittles clean
```

This deletes the entire output directory (default: `build/`), including the `.skittles-cache.json` cache file. Use this to force a full recompilation.

### Example Output

```
🍬 Skittles

ℹ Removing build directory: build/
✔ Build artifacts cleaned
```

## init

Scaffold a new Skittles project in the current directory.

```bash
npx skittles init
```

This creates:

| File                   | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `contracts/Token.ts`   | Example ERC20 token contract                      |
| `skittles.config.json` | Compiler configuration with defaults              |
| `tsconfig.json`        | TypeScript configuration for contract development |
| `.gitignore` (updated) | Adds `build/`, `dist/`, `node_modules/`           |

If any file already exists, it is skipped with a warning.

### Example Output

```
🍬 Skittles

ℹ Initializing new Skittles project...
✔ Created contracts/ directory
✔ Created skittles.config.json
✔ Created contracts/Token.ts
✔ Created tsconfig.json
✔ Updated .gitignore
✔ Skittles project initialized! Run 'skittles compile' to compile your contracts.
```

## Global Options

| Flag        | Description                         |
| ----------- | ----------------------------------- |
| `--help`    | Show help for a command             |
| `--version` | Show the installed Skittles version |

```bash
npx skittles --version
npx skittles compile --help
```
