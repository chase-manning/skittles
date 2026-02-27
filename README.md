<a href="https://skittles.dev/">
  <img src="https://skittles.dev/banner.png" alt="Skittles" width="100%" />
</a>

# Skittles

Write smart contracts in TypeScript.

Skittles lets you write blockchain smart contracts using TypeScript — the language you already know. No new syntax to learn. Full IDE support with autocomplete, type checking, and go-to-definition. Under the hood, Skittles compiles to Solidity for compatibility with every EVM tool and blockchain.

Website: [skittles.dev](https://skittles.dev/)

## Quick Start

Requires Node.js 22+.

```bash
npx skittles@latest init
npx skittles compile
```

This scaffolds a project with an example token contract and compiles it to `build/`.

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

This creates a simple token contract. Users can transfer tokens to each other, with balance checks and a Transfer event that logs activity on the blockchain.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
