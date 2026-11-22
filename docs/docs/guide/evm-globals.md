---
sidebar_position: 7
title: EVM Globals
---

# EVM Globals

Skittles provides blockchain globals with information about who called your contract, when and how. Import them from `skittles` and use them in your contracts.

## Transaction Context

```typescript
import { msg, block, tx } from "skittles";
```

### msg

| Property | Type | Description |
| --- | --- | --- |
| `msg.sender` | `address` | The wallet address that called your function |
| `msg.value` | `uint256` | The amount of ETH sent with the call |
| `msg.data` | `bytes` | The raw data of the function call |

```typescript
class Token {
  owner: address = msg.sender;

  deposit(): void {
    // Accessing msg.value makes this function payable
    this.balances[msg.sender] += msg.value;
  }
}
```

### block

| Property | Type | Description |
| --- | --- | --- |
| `block.timestamp` | `uint256` | The timestamp of the current block (in seconds since Unix epoch) |
| `block.number` | `uint256` | The current block number |
| `block.chainid` | `uint256` | The chain ID (1 for Ethereum mainnet, etc.) |
| `block.coinbase` | `address` | The address of the block miner or validator |

```typescript
class Staking {
  private depositTimestamps: Record<address, number> = {};

  deposit(): void {
    this.depositTimestamps[msg.sender] = block.timestamp;
  }
}
```

### tx

| Property | Type | Description |
| --- | --- | --- |
| `tx.origin` | `address` | The original sender of the transaction (the wallet that started it) |
| `tx.gasprice` | `uint256` | The gas price of the transaction |

## self (Contract Address)

Use `self` to get the contract's own address. This is Skittles' equivalent of Solidity's `address(this)`.

```typescript
import { self, address } from "skittles";

let contractAddress: address = self;
```

`self` is an `address` value, so you can use it anywhere you'd use an address, such as in comparisons, as a function argument or to send ETH. Like `address`, `self` is typed as `string` in the TypeScript type stubs, so calling `.transfer(amount)` or reading `.balance` on `self` can show a type error in your editor even though the compiled Solidity is correct:

```typescript
import { self, msg, address } from "skittles";

class Vault {
  public getContractAddress(): address {
    return self;
  }

  public isSelf(addr: address): boolean {
    return addr == self;
  }

  public deposit(to: address, amount: number): void {
    to.transfer(amount);
  }
}
```

:::tip
If you're coming from Solidity, use `self` instead of `address(this)`. Although `address(this)` is passed through to the compiler, `address` is a type-only export in Skittles' TypeScript typings, so `address(this)` fails TypeScript checking and IntelliSense. `self` is a value-level `address` and works with TypeScript checking.
:::

## Address Balance

Use `.balance` on any address to read its ETH balance (in wei):

```typescript
import { self, address, msg } from "skittles";

class Vault {
  public getContractBalance(): number {
    return self.balance;
  }

  public getBalance(addr: address): number {
    return addr.balance;
  }

  public getSenderBalance(): number {
    return msg.sender.balance;
  }
}
```

:::note
The Skittles compiler supports `.balance` on any address-typed expression, but the TypeScript type stubs model `address` as `string`, so `.balance` can show a type error in your editor. The compiled Solidity output is still correct.
:::

## ETH Transfers

Use `.transfer(amount)` on any address to send ETH from the contract:

```typescript
import { address, msg } from "skittles";

class Vault {
  public receive(): void {
    // Accept ETH deposits
  }

  public withdraw(to: address, amount: number): void {
    to.transfer(amount);
  }

  public refund(): void {
    msg.sender.transfer(100);
  }
}
```

The `.transfer(amount)` method sends that amount of wei and reverts if the transfer fails. The contract must have enough ETH to cover it.

## Built In Functions

Import built-in functions from `"skittles"`:

```typescript
import { bytes32, keccak256, sha256, ecrecover, abi, gasleft } from "skittles";
```

### Hashing

| Function | Description |
| --- | --- |
| `keccak256(...)` | Compute Keccak256 hash of the packed encoding of the arguments |
| `sha256(...)` | Compute SHA256 hash of the packed encoding of the arguments |
| `hash(...)` | Alias for `keccak256` |

```typescript
let digest: bytes32 = keccak256(msg.sender, amount);
```

Hash functions return `bytes32`. The type is also inferred automatically:

```typescript
const digest = keccak256(msg.sender, amount); // inferred as bytes32
```

### ABI Encoding

| Function | Description |
| --- | --- |
| `abi.encode(...)` | Encode arguments using the ABI encoding specification |
| `abi.encodePacked(...)` | Encode arguments using packed encoding (more compact) |
| `abi.decode<[...]>(data)` | Decode ABI-encoded data back into typed values |

Use type parameters to specify the types you want to decode into:

```typescript
const [amount, addr] = abi.decode<[number, address]>(data);
```

This compiles to Solidity's `abi.decode(data, (uint256, address))`.

### Cryptography

| Function | Description |
| --- | --- |
| `ecrecover(hash, v, r, s)` | Recover the signer's address from a message hash and signature. `hash`, `r` and `s` are `bytes32`; returns `address`. |

### Math

| Function | Description |
| --- | --- |
| `Math.min(a, b)` | Return the smaller of two values |
| `Math.max(a, b)` | Return the larger of two values |
| `Math.sqrt(x)` | Compute the integer square root of a value |
| `Math.pow(a, b)` | Raise `a` to the power `b` (same as `a ** b`) |
| `addmod(x, y, k)` | Compute `(x + y) % k` with arbitrary precision (no overflow) |
| `mulmod(x, y, k)` | Compute `(x * y) % k` with arbitrary precision (no overflow) |

```typescript
let smaller = Math.min(a, b);
let clamped = Math.min(Math.max(value, min), max);
let root = Math.sqrt(x);
```

### Utilities

| Function | Description |
| --- | --- |
| `assert(condition)` | Assert that a condition is true (panics and reverts if false) |
| `gasleft()` | Get the amount of gas remaining for the current transaction |

### String and Bytes Concatenation

| Function | Description |
| --- | --- |
| `string.concat(...)` | Concatenate multiple strings into one |
| `bytes.concat(...)` | Concatenate multiple byte arrays into one |

Template literals compile to `string.concat()`:

```typescript
let greeting: string = `Hello ${name}!`;
```

## Special Values

| TypeScript | Description |
| --- | --- |
| `Number.MAX_VALUE` | The maximum value for a uint256 (2^256 - 1) |
| `null` | Represents zero/empty value (compiles to 0) |
| `undefined` | Represents zero/empty value (compiles to 0) |
