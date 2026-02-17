# Contributing

Thanks for your interest in contributing to Skittles.

## Setup

```bash
git clone https://github.com/chase-manning/skittles.git
cd skittles
yarn install
```

Requires Node.js 20 or later.

## Development

Build the compiler:

```bash
yarn build
```

Run tests:

```bash
yarn test
```

Run the example project:

```bash
cd example
yarn install
yarn test
```

## Making Changes

1. Fork the repo and create a branch from `v2`.
2. Make your changes.
3. Add or update tests for your changes.
4. Run `yarn test` and make sure everything passes.
5. Open a pull request against `v2`.

## Project Structure

- `src/compiler/parser.ts` parses TypeScript AST into the Skittles IR.
- `src/compiler/codegen.ts` generates Solidity from the IR.
- `src/compiler/solc.ts` compiles Solidity to ABI and bytecode.
- `src/compiler/compiler.ts` orchestrates the full pipeline.
- `src/commands/` contains the CLI commands.
- `test/` contains the test suite.
- `example/` is a working example project.

## Reporting Issues

Use the GitHub issue templates for bug reports and feature requests.
