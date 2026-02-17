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
  test/               Contract tests
    helpers.ts        Test utilities (deploy, connect, load artifacts)
    Token.test.ts
    Staking.test.ts
  build/              Compiled output (generated, gitignored)
    abi/              Contract ABIs as JSON
    bytecode/         EVM bytecode
    solidity/         Generated Solidity source
  package.json
  skittles.config.json
  tsconfig.json
  vitest.config.ts
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

This generates ABI, bytecode, and Solidity files in `build/`.

Run the tests:

```bash
yarn test
```

This compiles the contracts and then runs the test suite.

Clean build artifacts:

```bash
yarn clean
```

## Testing

Tests use [vitest](https://vitest.dev/) as the test runner with [Hardhat](https://hardhat.org/) providing an in-memory EVM and [ethers.js v6](https://docs.ethers.org/v6/) for contract interaction.

The test workflow:

1. `yarn compile` produces ABI and bytecode artifacts in `build/`.
2. Tests load these artifacts from disk using the `loadArtifact` helper.
3. A fresh in-memory EVM is spun up for each test file via Hardhat's EDR.
4. Contracts are deployed and tested using ethers.js.

## Configuration

`skittles.config.json` controls the compiler:

| Key | Default | Description |
| --- | ------- | ----------- |
| `contractsDir` | `"contracts"` | Directory containing `.ts` contract files |
| `outputDir` | `"build"` | Directory for compiled artifacts |
| `typeCheck` | `true` | Enable TypeScript type checking |
| `optimizer.enabled` | `false` | Enable the Solidity optimizer |
| `optimizer.runs` | `200` | Optimizer runs (higher = cheaper calls, larger deploy) |

## Adapting for Your Project

When starting a new project, the quickest way is to copy this example directory and modify:

1. Replace the contracts in `contracts/` with your own.
2. Update `package.json` to use the published package: change `"skittles": "file:.."` to `"skittles": "^2.0.0"`.
3. Write tests in `test/` following the patterns shown.

Alternatively, run `skittles init` in an empty directory to scaffold a minimal project.
