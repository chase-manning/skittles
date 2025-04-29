# Skittles

Skittles is a TypeScript-to-EVM bytecode compiler that enables developers to write Ethereum smart contracts using TypeScript syntax. It provides a familiar development experience for TypeScript developers while generating efficient EVM bytecode for deployment on Ethereum and compatible networks.

## Why Skittles?

Writing smart contracts in Solidity can be challenging for developers coming from traditional web development backgrounds. Skittles bridges this gap by allowing you to:

- Write smart contracts in TypeScript, a language you already know and love
- Leverage TypeScript's type system for better development experience
- Use familiar programming patterns and constructs
- Take advantage of modern development tools and IDE support
- Maintain consistency between your frontend and smart contract codebases

## Features

- Full TypeScript support with type checking
- Class-based contract development
- Event handling
- Inheritance and interfaces
- Access modifiers (public, private, protected)
- Mapping and array support
- Built-in Ethereum-specific types and globals
- Comprehensive testing framework
- Hardhat integration

## Installation

```bash
npm install skittles
# or
yarn add skittles
```

## Quick Start

Here's a simple example of a Skittles smart contract:

```typescript
import { address, SkittlesEvent } from "skittles/types/core-types";

interface TransferEvent {
  from: address;
  to: address;
  amount: number;
}

export class Token {
  private _balances: Record<address, number>;
  Transfer: SkittlesEvent<TransferEvent>;

  constructor() {
    this._balances = {};
  }

  transfer(to: address, amount: number): boolean {
    if (this._balances[msg.sender] < amount) {
      return false;
    }

    this._balances[msg.sender] -= amount;
    this._balances[to] += amount;

    this.Transfer.emit({
      from: msg.sender,
      to,
      amount
    });

    return true;
  }

  balanceOf(account: address): number {
    return this._balances[account];
  }
}
```

## Project Structure

- `src/` - Core compiler implementation
- `contracts/` - Example contracts and implementations
- `test/` - Test suite
- `skittles.config.ts` - Configuration file

## Configuration

Create a `skittles.config.ts` file in your project root:

```typescript
export default {
  contracts: {
    outDir: "./dist",
    sourceDir: "./contracts"
  }
};
```

## Development Status

Skittles is currently in active development. While it's broadly functional, some features are still being implemented. Check the [TODO.md](TODO.md) file for the latest status and planned features.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Documentation

For more detailed documentation, please refer to the examples in the `contracts/` directory. The regression test contract (`contracts/regression-test/regression-test.ts`) demonstrates all currently supported features.
