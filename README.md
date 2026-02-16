# Skittles

Write Solidity smart contracts in TypeScript.

Skittles compiles TypeScript classes to Solidity source code, then to ABI and EVM bytecode. You get TypeScript tooling (autocomplete, type checking, familiar syntax) while targeting the EVM.

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

## Features

**Types** that map to Solidity: `number` (uint256), `string`, `boolean` (bool), `address`, `bytes`, `Record<K,V>` (mapping), `T[]` (array), interfaces (structs), enums.

**State variables** with visibility (`public`, `private`), `readonly` (immutable), and `static readonly` (constant).

**Functions** with automatic state mutability inference (pure, view, payable), virtual/override, getters/setters, `receive()`, and `fallback()`.

**Events** via `SkittlesEvent<T>` with indexed parameter support.

**Custom errors** via `SkittlesError<T>` or class extends Error.

**Inheritance** with `extends` and `super`.

**Control flow**: if/else, for, while, do/while, for...of, switch/case, ternary.

**EVM globals**: `msg.sender`, `msg.value`, `block.timestamp`, `block.number`, `tx.origin`, and more.

**Built in functions**: `keccak256()`, `sha256()`, `hash()`, `assert()`, `abi.encode()`, `abi.encodePacked()`.

**Cross file support**: shared structs, enums, constants, and functions across contract files.

**Incremental compilation**: only recompiles files that have changed.

## Build Output

```
build/
  abi/          # Contract ABIs (JSON)
  bytecode/     # EVM bytecode
  solidity/     # Generated Solidity source
```

## Configuration

Create a `skittles.config.json` in your project root:

```json
{
  "contractsDir": "contracts",
  "outputDir": "build",
  "typeCheck": true,
  "optimizer": {
    "enabled": true,
    "runs": 200
  }
}
```

## Testing

Skittles generates standard Solidity artifacts (ABI + bytecode), so you can test with any EVM testing tool. The [example project](./example) uses Hardhat and ethers.js with Vitest.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
