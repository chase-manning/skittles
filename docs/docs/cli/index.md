---
sidebar_position: 1
title: CLI Reference
---

# CLI Reference

The Skittles CLI compiles and manages your contract projects. For testing, use Hardhat (see the [Testing Guide](/guide/testing)).

```bash
skittles <command> [options]
```

## compile

Compile all TypeScript contract files to Solidity.

```bash
npx skittles compile
```

### `--watch` / `-w`

Watch for file changes in the contracts directory and recompile automatically.

```bash
npx skittles compile --watch
```

The compiler runs an initial build and then watches `.ts` files, recompiling whenever a file changes. You can run it alongside Hardhat's test watching.

This command:

1. Loads the configuration from `skittles.config.json` or `skittles.config.js`
2. Finds all `.ts` files in the configured `contractsDir` (default: `contracts/`)
3. Scans files first to collect shared types, enums, interfaces, functions and constants
4. Parses each file's TypeScript AST into the Skittles intermediate representation
5. Generates Solidity source from the intermediate representation
6. Writes Solidity files to the `solidity/` subdirectory of `outputDir` (the default `outputDir` is `artifacts/`, so Solidity goes to `artifacts/solidity/`)

Output structure:

```
artifacts/
├── solidity/
│   ├── Token.sol        # Generated Solidity source
│   └── Staking.sol
cache/
└── .skittles-cache.json  # Incremental compilation cache
```

To produce ABI and EVM bytecode, use Hardhat. Point `paths.sources` in `hardhat.config.ts` at `./artifacts/solidity` and run `hardhat compile` or `hardhat test`. Hardhat compiles the generated Solidity and emits the artifacts.

Incremental compilation is automatic. Each file is hashed with SHA-256 and unchanged files are served from the cache. Changing a parent contract recompiles the files that extend it, and changing any shared definition or the `consoleLog`, Solidity or formatting config recompiles every file.

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

### `--no-install`

Skip dependency installation. By default, `init` picks npm, yarn or pnpm based on the lock file it finds and installs dependencies automatically. Pass `--no-install` if you want to install them yourself.

```bash
npx skittles@latest init --no-install
```

This creates:

| File                   | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| `package.json`         | Created or updated with scripts and dependencies                         |
| `contracts/Token.ts`   | Example ERC20 token extending the built-in ERC20 with an owner-only mint |
| `test/Token.test.ts`   | Example test using Hardhat, Mocha and fixtures                           |
| `skittles.config.json` | Compiler configuration with console logging enabled                      |
| `tsconfig.json`        | TypeScript configuration for contract development                        |
| `hardhat.config.ts`    | Hardhat config with Ethers toolbox and paths                             |
| `.gitignore` (updated) | Adds `artifacts/`, `cache/`, `dist/`, `node_modules/`                    |

An ESLint config is also created. If any file already exists, it is skipped with a warning.

The test file uses a fixture (`loadFixture`) and an event assertion (`.to.emit`) across 4 tests: the token name, the initial supply going to the deployer, the Transfer event on transfer and the owner minting tokens. The test script runs `skittles compile && hardhat test`.

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

## Exit Codes

| Code | Meaning                                                |
| ---- | ------------------------------------------------------ |
| `0`  | Success                                                |
| `1`  | Compilation error (syntax error or unexpected failure) |
