# Skittles Example Project

A complete example showing how to build, test and structure a Skittles smart contract project.

## Contracts

- **Token.ts**: A full ERC20 token with transfer, approve and transferFrom. It uses events with indexed parameters, custom errors, private helpers and Number.MAX_VALUE for infinite allowances.
- **Staking.ts**: An ETH staking vault where users deposit and withdraw ETH. It uses enums, constant and immutable state variables, receive() for plain ETH transfers, owner access control, pausability and fee calculations.

## Project Structure

```
example/
  contracts/          TypeScript smart contracts
    Token.ts
    Staking.ts
  test/               Contract tests (Hardhat + Mocha)
    Token.test.ts
    Staking.test.ts
  artifacts/            Compiled output (generated, gitignored)
    solidity/         Generated Solidity source (Hardhat compiles to ABI/bytecode)
  cache/              Compilation cache (generated, gitignored)
  package.json
  skittles.config.json
  hardhat.config.ts
  tsconfig.json
```

## Getting Started

Install dependencies:

```bash
npm install
```

Compile the contracts:

```bash
npm run compile
```

This generates Solidity files in `artifacts/solidity/`. Hardhat compiles them when you run tests.

Run the tests:

```bash
npm test
```

This compiles the contracts with Skittles, then runs Hardhat tests against the generated Solidity.

Clean build artefacts:

```bash
npm run clean
```

## Testing

Tests use [Hardhat](https://hardhat.org) with Mocha, ethers.js v6 and the patterns from the [Hardhat testing guide](https://hardhat.org/docs/guides/testing/using-ethers):

- `network.connect()` for an in-memory EVM per test file
- `loadFixture` for fast test setup and state reset
- `.to.emit()`, `.revertedWith()` and `.revertedWithCustomError()` for assertions

How the tests run:

1. `npm test` runs `skittles compile` first and writes build artefacts to `artifacts/`.
2. Hardhat compiles the generated Solidity from `artifacts/solidity`.
3. Tests deploy contracts and run assertions against the in-memory EVM.

## Configuration

`skittles.config.json` controls the compiler:

| Key | Default | Description |
| --- | ------- | ----------- |
| `contractsDir` | `"contracts"` | Directory containing `.ts` contract files |
| `outputDir` | `"artifacts"` | Directory for generated Solidity output |
| `typeCheck` | `true` | Enable TypeScript type checking |

Optimiser settings live in `hardhat.config.ts` under `solidity.settings.optimizer`.

## Adapting for Your Project

To use this example for a new project, copy this directory and make these changes:

1. Replace the contracts in `contracts/` with your own.
2. Update `package.json` to use the published package: change `"skittles": "file:.."` to `"skittles": "^1.0.0"`.
3. Write tests in `test/` following the Hardhat patterns shown.

You can also run `skittles init` in an empty directory to scaffold a minimal project.
