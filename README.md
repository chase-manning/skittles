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
# Using npm
npm install skittles

# Using Yarn
yarn add skittles

# Global install
npm i -g skittles
```

## Quick Start

### Initialize a New Project

The easiest way to get started is to use the `init` command:

```bash
# Initialize a new project
skittles init

# Overwrite existing files
skittles init --force
```

This will:

- Create `skittles.config.ts` with sensible defaults
- Create `contracts/` directory
- Add an example ERC20 contract
- Update `.gitignore` with build artifacts
- Add `compile` and `clean` scripts to `package.json` (if it exists)

### Manual Setup

If you prefer to set up manually, your projects should be structured like:

- `contracts/` - All of your contracts, e.g. `erc20.ts`
- `skittles.config.ts` - Configuration file

Here's a simple example of a Skittles smart contract:

```typescript
import { address, msg, SkittlesEvent } from "skittles/lib/types/core-types";

export interface TransferEvent {
  from: address;
  to: address;
  amount: number;
}

export interface ApprovalEvent {
  owner: address;
  spender: address;
  amount: number;
}

export class ERC20 {
  readonly decimals: number = 18;
  readonly symbol: string = "TEST";
  readonly name: string = "TEST ERC20";

  totalSupply: number;
  balanceOf: Record<address, number>;
  allowance: Record<address, Record<address, number>>;

  Transfer: SkittlesEvent<TransferEvent>;
  Approval: SkittlesEvent<ApprovalEvent>;

  approve(spender: address, amount: number): boolean {
    this.allowance[msg.sender][spender] = amount;
    this.Approval.emit({ owner: msg.sender, spender, amount });
    return true;
  }

  transfer(to: address, amount: number): boolean {
    this._transfer(msg.sender, to, amount);
    return true;
  }

  transferFrom(from: address, to: address, amount: number): boolean {
    if (this.allowance[from][msg.sender] !== Number.MAX_VALUE) {
      this.allowance[from][msg.sender] -= amount;
    }
    this._transfer(from, to, amount);
    return true;
  }

  private _transfer(from: address, to: address, amount: number): void {
    this.balanceOf[to] += amount;
    this.balanceOf[from] -= amount;
    this.Transfer.emit({ from, to, amount });
  }
}
```

You can compile with `skittles compile`, you might want to add a script for this in your package.json, e.g.

```json
  "scripts": {
    "compile": "skittles compile",
  },
```

Or if you installed globally with `npm i -g skittles`, then you can just run `skittles compile` in your terminal.

## Configuration

Create a `skittles.config.ts` file in your project root:

```typescript
import { SkittlesConfig } from "skittles/lib/types/core-types";

const config: SkittlesConfig = {
  optimizer: {
    enabled: true,
    runs: 200,
  },
};

export default config;
```

The configuration options include:

- `optimizer.enabled`: Enable/disable the optimizer
- `optimizer.runs`: Number of runs for the optimizer (default: 200)
- Many more, look in the `SkittlesConfig` type to see full details

## Development Status

Skittles is currently in active development. While it's broadly functional, some features are still being implemented. Check the [TODO.md](TODO.md) file for the latest status and planned features. It is not recommended for production use currently.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Documentation

For more detailed documentation, please refer to the examples in the `contracts/` directory. The regression test contract (`contracts/regression-test/regression-test.ts`) demonstrates all currently supported features.
