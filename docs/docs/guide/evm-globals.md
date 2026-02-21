---
sidebar_position: 7
title: EVM Globals
---

# EVM Globals

Skittles gives you access to blockchain context — information about who's calling your contract, when, and how. Import them from `skittles` and use them in your contracts.

## Transaction Context

```typescript
import { msg, block, tx } from "skittles";
```

### msg

| Property     | Type      | Description                                                                  |
| ------------ | --------- | ---------------------------------------------------------------------------- |
| `msg.sender` | `address` | The wallet address that called your function                                 |
| `msg.value`  | `uint256` | The amount of ETH sent with the call                                        |
| `msg.data`   | `bytes`   | The raw data of the function call                                            |

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

| Property          | Type      | Description                                                     |
| ----------------- | --------- | --------------------------------------------------------------- |
| `block.timestamp` | `uint256` | The timestamp of the current block (in seconds since Unix epoch)|
| `block.number`    | `uint256` | The current block number                                        |
| `block.chainid`   | `uint256` | The chain ID (1 for Ethereum mainnet, etc.)                     |
| `block.coinbase`  | `address` | The address of the block miner or validator                     |

```typescript
class Staking {
  private depositTimestamps: Record<address, number> = {};

  deposit(): void {
    this.depositTimestamps[msg.sender] = block.timestamp;
  }
}
```

### tx

| Property      | Type      | Description                                                          |
| ------------- | --------- | -------------------------------------------------------------------- |
| `tx.origin`   | `address` | The original sender of the transaction (the wallet that started it)  |
| `tx.gasprice` | `uint256` | The gas price of the transaction                                     |

## self

Use `self` to get the contract's own address.

```typescript
import { self, address } from "skittles";

let contractAddress: address = self;
```

## Built In Functions

Import built in functions from `"skittles"`:

```typescript
import { keccak256, sha256, ecrecover, abi, gasleft } from "skittles";
```

### Hashing

| Function         | Description                                                   |
| ---------------- | ------------------------------------------------------------- |
| `keccak256(...)` | Compute Keccak256 hash of the packed encoding of the arguments|
| `sha256(...)`    | Compute SHA256 hash of the packed encoding of the arguments   |
| `hash(...)`      | Alias for `keccak256`                                         |

```typescript
let digest: string = keccak256(msg.sender, amount);
```

### ABI Encoding

| Function                | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `abi.encode(...)`       | Encode arguments using the ABI encoding specification         |
| `abi.encodePacked(...)` | Encode arguments using packed encoding (more compact)          |
| `abi.decode(...)`       | Decode ABI-encoded data back into typed values                |

### Cryptography

| Function                   | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `ecrecover(hash, v, r, s)` | Recover the signer's address from a message hash and signature   |

### Math

| Function          | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| `addmod(x, y, k)` | Compute `(x + y) % k` with arbitrary precision (no overflow)  |
| `mulmod(x, y, k)` | Compute `(x * y) % k` with arbitrary precision (no overflow)  |

### Utilities

| Function            | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| `assert(condition)` | Assert that a condition is true (panics and reverts if false)     |
| `gasleft()`         | Get the amount of gas remaining for the current transaction       |

### String and Bytes Concatenation

| Function             | Description                                         |
| -------------------- | --------------------------------------------------- |
| `string.concat(...)` | Concatenate multiple strings into one               |
| `bytes.concat(...)`  | Concatenate multiple byte arrays into one           |

Template literals are automatically compiled to `string.concat()`:

```typescript
let greeting: string = `Hello ${name}!`;
```

## Special Values

| TypeScript         | Description                                                    |
| ------------------ | -------------------------------------------------------------- |
| `Number.MAX_VALUE` | The maximum value for a uint256 (2^256 - 1)                   |
| `null`             | Represents zero/empty value (compiles to 0)                    |
| `undefined`        | Represents zero/empty value (compiles to 0)                    |
