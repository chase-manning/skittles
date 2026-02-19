<a href="https://skittles.dev/">
  <img src="https://skittles.dev/banner.png" alt="Skittles" width="100%" />
</a>

# Skittles

Write, Test and Deploy EVM Smart Contracts with TypeScript.

Skittles compiles TypeScript classes to Solidity source code. Use Hardhat (or any Solidity toolchain) to compile that to ABI and EVM bytecode. You get TypeScript tooling (autocomplete, type checking, familiar syntax) while targeting the EVM.

Website: [skittles.dev](https://skittles.dev/)

## Install

```bash
npm install skittles
```

Requires Node.js 20+.

## Quick Start

```bash
npx skittles init
npx skittles compile
```

This creates a `contracts/` directory with an example token contract and compiles it to `build/`.

## Example

```typescript
import { address, msg, SkittlesEvent, Indexed } from "skittles";

export class Token {
  Transfer: SkittlesEvent<{
    from: Indexed<address>;
    to: Indexed<address>;
    value: number;
  }>;

  name: string = "My Token";
  symbol: string = "TKN";
  totalSupply: number = 0;
  balances: Record<address, number> = {};

  constructor(initialSupply: number) {
    this.totalSupply = initialSupply;
    this.balances[msg.sender] = initialSupply;
  }

  transfer(to: address, amount: number): boolean {
    if (this.balances[msg.sender] < amount) {
      throw new Error("Insufficient balance");
    }
    this.balances[msg.sender] -= amount;
    this.balances[to] += amount;
    this.Transfer.emit({ from: msg.sender, to, value: amount });
    return true;
  }
}
```

This compiles to a Solidity contract with events, mappings, a constructor, and a transfer function.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
