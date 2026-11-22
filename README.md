<a href="https://skittles.dev/">
  <img src="https://skittles.dev/banner.png" alt="Skittles" width="100%" />
</a>

# Skittles

Write EVM smart contracts in TypeScript.

Skittles is an open-source compiler that turns exported TypeScript classes into standard Solidity. You keep IDE autocomplete, type checking and go-to-definition. The output works with Hardhat, Foundry, ethers.js and viem, and contracts deploy to EVM chains such as Ethereum, Polygon, Arbitrum and Base.

Website: [skittles.dev](https://skittles.dev/)

## Quick Start

Requires Node.js 22+.

```bash
npx skittles@latest init
npx skittles compile
```

The first command scaffolds a project with an ERC20 Token contract and tests, then installs dependencies. The second writes generated Solidity to `artifacts/solidity/`.

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

This contract defines a simple token. The constructor assigns the initial supply to the deployer, and the transfer method checks the sender's balance, moves tokens and emits a Transfer event.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
