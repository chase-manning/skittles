# Skittles Example Project

A complete example showing how to build, test, and structure a Skittles smart contract project.

## Contracts

- **Token.ts** — A full ERC20 token with transfer, approve, and transferFrom. Demonstrates events with indexed parameters, custom errors, private helpers, and Number.MAX_VALUE for infinite allowances.
- **Staking.ts** — An ETH staking vault where users deposit and withdraw ETH. Demonstrates enums, constant/immutable state variables, receive() for plain ETH transfers, owner access control, pausability, and fee calculations.

## Project Structure

```
example/
  contracts/          TypeScript smart contracts
    Token.ts
    Staking.ts
  test/               Contract tests (Hardhat + Mocha)
    Token.test.ts
    Staking.test.ts
  build/              Compiled output (generated, gitignored)
    solidity/         Generated Solidity source (Hardhat compiles to ABI/bytecode)
  package.json
  skittles.config.json
  hardhat.config.ts
  tsconfig.json
```

## Getting Started

Install dependencies:

```bash
yarn install
```

Compile the contracts:

```bash
yarn compile
```

This generates Solidity files in `build/solidity/`. Hardhat compiles them when you run tests.

Run the tests:

```bash
yarn test
```

This compiles the contracts with Skittles, then runs Hardhat tests against the generated Solidity.

Clean build artifacts:

```bash
yarn clean
```

## Testing

Tests use [Hardhat](https://hardhat.org) with Mocha, ethers.js v6, and the [Hardhat testing guide](https://hardhat.org/docs/guides/testing/using-ethers) patterns:

- `network.connect()` for an in-memory EVM per test file
- `loadFixture` for fast test setup and state reset
- `.to.emit()` and `.revertedWith()` / `.revertedWithCustomError()` for assertions

The test workflow:

1. `yarn test` runs `skittles compile` first, producing artifacts in `build/`.
2. Hardhat compiles the generated Solidity from `build/solidity`.
3. Tests deploy contracts and run assertions against the in-memory EVM.

## Configuration

`skittles.config.json` controls the compiler:

| Key | Default | Description |
| --- | ------- | ----------- |
| `contractsDir` | `"contracts"` | Directory containing `.ts` contract files |
| `outputDir` | `"build"` | Directory for compiled Solidity output |
| `typeCheck` | `true` | Enable TypeScript type checking |

Optimizer settings live in `hardhat.config.ts` under `solidity.settings.optimizer`.

## Adapting for Your Project

When starting a new project, the quickest way is to copy this example directory and modify:

1. Replace the contracts in `contracts/` with your own.
2. Update `package.json` to use the published package: change `"skittles": "file:.."` to `"skittles": "^1.0.0"`.
3. Write tests in `test/` following the Hardhat patterns shown.

Alternatively, run `skittles init` in an empty directory to scaffold a minimal project.
