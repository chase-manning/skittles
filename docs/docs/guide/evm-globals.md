---
sidebar_position: 7
title: EVM Globals
---

# EVM Globals

Skittles provides typed stubs for all standard EVM global objects and built in functions. Import them from `"skittles"` and use them directly in your contracts.

## Transaction Context

```typescript
import { msg, block, tx } from "skittles";
```

### msg

| Property     | Solidity     | Type      | Description                                       |
| ------------ | ------------ | --------- | ------------------------------------------------- |
| `msg.sender` | `msg.sender` | `address` | Address of the caller                             |
| `msg.value`  | `msg.value`  | `uint256` | ETH sent with the call (makes function `payable`) |
| `msg.data`   | `msg.data`   | `bytes`   | Raw calldata                                      |

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

| Property          | Solidity          | Type      | Description                   |
| ----------------- | ----------------- | --------- | ----------------------------- |
| `block.timestamp` | `block.timestamp` | `uint256` | Current block timestamp       |
| `block.number`    | `block.number`    | `uint256` | Current block number          |
| `block.chainid`   | `block.chainid`   | `uint256` | Chain ID                      |
| `block.coinbase`  | `block.coinbase`  | `address` | Block miner/validator address |

```typescript
class Staking {
  private depositTimestamps: Record<address, number> = {};

  deposit(): void {
    this.depositTimestamps[msg.sender] = block.timestamp;
  }
}
```

### tx

| Property      | Solidity      | Type      | Description                        |
| ------------- | ------------- | --------- | ---------------------------------- |
| `tx.origin`   | `tx.origin`   | `address` | Original sender of the transaction |
| `tx.gasprice` | `tx.gasprice` | `uint256` | Gas price of the transaction       |

## self

Import `self` from `"skittles"` to reference the contract's own address. It compiles to Solidity's `address(this)`.

```typescript
import { self, address } from "skittles";

let contractAddress: address = self;
// Generates: address(this)
```

## Built In Functions

Import built in functions from `"skittles"`:

```typescript
import { keccak256, sha256, ecrecover, abi, gasleft } from "skittles";
```

### Hashing

| Function         | Solidity                           | Description           |
| ---------------- | ---------------------------------- | --------------------- |
| `keccak256(...)` | `keccak256(abi.encodePacked(...))` | Keccak256 hash        |
| `sha256(...)`    | `sha256(abi.encodePacked(...))`    | SHA256 hash           |
| `hash(...)`      | `keccak256(abi.encodePacked(...))` | Alias for `keccak256` |

```typescript
let digest: string = keccak256(msg.sender, amount);
// Generates: bytes32 digest = keccak256(abi.encodePacked(msg.sender, amount));
```

### ABI Encoding

| Function                | Solidity                | Description       |
| ----------------------- | ----------------------- | ----------------- |
| `abi.encode(...)`       | `abi.encode(...)`       | ABI encode        |
| `abi.encodePacked(...)` | `abi.encodePacked(...)` | Packed ABI encode |
| `abi.decode(...)`       | `abi.decode(...)`       | ABI decode        |

### Cryptography

| Function                   | Solidity                   | Description                   |
| -------------------------- | -------------------------- | ----------------------------- |
| `ecrecover(hash, v, r, s)` | `ecrecover(hash, v, r, s)` | Recover signer from signature |

### Math

| Function          | Solidity          | Description                            |
| ----------------- | ----------------- | -------------------------------------- |
| `addmod(x, y, k)` | `addmod(x, y, k)` | `(x + y) % k` with overflow protection |
| `mulmod(x, y, k)` | `mulmod(x, y, k)` | `(x * y) % k` with overflow protection |

### Utilities

| Function            | Solidity            | Description                            |
| ------------------- | ------------------- | -------------------------------------- |
| `assert(condition)` | `assert(condition)` | Assert a condition (panics on failure) |
| `gasleft()`         | `gasleft()`         | Remaining gas                          |

### String and Bytes Concatenation

| Function             | Solidity             | Description         |
| -------------------- | -------------------- | ------------------- |
| `string.concat(...)` | `string.concat(...)` | Concatenate strings |
| `bytes.concat(...)`  | `bytes.concat(...)`  | Concatenate bytes   |

Template literals are automatically compiled to `string.concat()`:

```typescript
let greeting: string = `Hello ${name}!`;
// Generates: string memory greeting = string.concat("Hello ", name, "!");
```

## Special Values

| TypeScript         | Solidity            | Description           |
| ------------------ | ------------------- | --------------------- |
| `Number.MAX_VALUE` | `type(uint256).max` | Maximum uint256 value |
| `null`             | `0`                 | Zero value            |
| `undefined`        | `0`                 | Zero value            |
