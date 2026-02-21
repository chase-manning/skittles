---
sidebar_position: 1
title: CLI Reference
---

# CLI Reference

The Skittles CLI provides commands for compiling and managing your contract projects. For testing, use Hardhat (see the [Testing Guide](/guide/testing)).

```bash
skittles <command> [options]
```

## compile

Compile all TypeScript contract files to Solidity.

```bash
npx skittles compile
```

This command:

1. Loads the configuration from `skittles.config.json` or `skittles.config.js`
2. Finds all `.ts` files in the configured `contractsDir` (default: `contracts/`)
3. Pre scans files to collect shared types, functions, and constants
4. Parses each file's TypeScript AST into the Skittles intermediate representation
5. Generates Solidity source code from the IR
6. Writes Solidity files to the `solidity/` subdirectory of the configured `outputDir` (default `outputDir`: `artifacts/`, so Solidity is written to `artifacts/solidity/`)

Output structure:

```
artifacts/
├── solidity/
│   ├── Token.sol        # Generated Solidity source
│   └── Staking.sol
cache/
└── .skittles-cache.json  # Incremental compilation cache
```

To produce ABI and EVM bytecode, use Hardhat. Configure `paths.sources` in `hardhat.config.ts` to point at `./artifacts/solidity` and run `hardhat compile` or `hardhat test`. Hardhat will compile the generated Solidity and emit artifacts.

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

This deletes the output directory (default: `artifacts/`) and the cache directory (default: `cache/`), including the `.skittles-cache.json` cache file. Use this to force a full recompilation.

### Example Output

```
🍬 Skittles

ℹ Removing output directory: artifacts/
ℹ Removing cache directory: cache/
✔ Build artifacts cleaned
```

## init

Scaffold a new Skittles project in the current directory.

```bash
npx skittles@latest init
```

This creates:

| File                   | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `contracts/Token.ts`   | Example ERC20 token contract with Transfer event  |
| `test/Token.test.ts`  | Example test using Hardhat + Mocha + fixtures    |
| `skittles.config.json` | Compiler configuration with defaults              |
| `tsconfig.json`        | TypeScript configuration for contract development |
| `hardhat.config.ts`    | Hardhat config with Ethers toolbox and paths      |
| `.gitignore` (updated) | Adds `artifacts/`, `cache/`, `dist/`, `node_modules/`          |

If any file already exists, it is skipped with a warning.

The test file demonstrates event assertions (`.to.emit`), revert checking (`.revertedWith`), and fixtures (`loadFixture`). The test script runs `skittles compile && hardhat test`.

### Example Output

```
🍬 Skittles

ℹ Initializing new Skittles project...
✔ Created contracts/ directory
✔ Created test/ directory
✔ Created skittles.config.json
✔ Created contracts/Token.ts
✔ Created test/Token.test.ts
✔ Created tsconfig.json
✔ Created hardhat.config.ts
✔ Updated .gitignore
✔ Dependencies installed
✔ Skittles project initialized!
ℹ
ℹ Next steps:
ℹ   Compile and test:
ℹ     npm run test
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
