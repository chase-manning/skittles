---
sidebar_position: 15
title: Unsupported Solidity Features
---

# Unsupported Solidity Features

If you're coming from Solidity, this page lists the Solidity features that Skittles doesn't currently support. If you're new to smart contracts and learning through Skittles, you can skip this page. None of these features are required to build contracts.

:::note
Skittles covers the most commonly used Solidity features. The items below are either advanced, niche or have TypeScript alternatives built into Skittles.
:::

## Modifiers

Solidity modifiers (such as `modifier onlyOwner()`) are not supported. In Skittles, you can do the same thing with a regular helper method:

```typescript title="contracts/MyContract.ts"
import { address, msg } from "skittles";

export class MyContract {
  owner: address = msg.sender;

  private onlyOwner(): void {
    if (msg.sender !== this.owner) {
      throw new Error("Not the owner");
    }
  }

  withdraw(): void {
    this.onlyOwner();
    // withdraw logic
  }
}
```

The standard library's [Ownable](/guide/standard-library#ownable) and [AccessControl](/guide/standard-library#accesscontrol) contracts also provide built-in access control without modifiers.

## Proxy and Upgradeable Contracts

Skittles does not support proxy patterns such as:

- Transparent proxy
- UUPS proxy
- Beacon proxy
- Diamond pattern (EIP-2535)

Contracts compiled with Skittles are not upgradeable. If you need upgradeability, you'll need to design your system with separate contracts and migrate state manually.

## Inline Assembly (YUL)

Solidity's `assembly { ... }` blocks for writing low-level EVM instructions in YUL are not supported. Skittles compiles high-level TypeScript constructs and does not expose raw opcodes.

## Libraries

Standalone Solidity libraries (`library MyLib { ... }`) are not supported. Use classes with `static` methods or regular exported functions across files instead:

```typescript title="contracts/MathUtils.ts"
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
```

```typescript title="contracts/MyContract.ts"
import { clamp } from "./MathUtils";

export class MyContract {
  stake(amount: number): void {
    const clamped = clamp(amount, 1, 1000);
    // ...
  }
}
```

## Low-Level Calls

The following low-level call methods are not supported:

- `delegatecall`
- `staticcall`
- Low-level `call` with custom calldata

Skittles supports high-level external contract calls through [interfaces](/guide/types#contract-interfaces) and the `Contract<T>()` wrapper. For sending Ether, use `address.transfer()`.

## Create2

The `create2` opcode for deploying contracts to deterministic addresses is not supported. Contract deployment in Skittles uses standard constructor-based deployment through Hardhat.

## Selfdestruct

The `selfdestruct()` function is not supported. `selfdestruct` is also deprecated in Solidity itself as of [EIP-6049](https://eips.ethereum.org/EIPS/eip-6049), and its behaviour changed after the Dencun upgrade.

## Unchecked Arithmetic

Solidity's `unchecked { ... }` blocks for disabling overflow and underflow checks are not supported. All arithmetic in Skittles uses Solidity's default checked arithmetic.

## Abstract Contracts

Solidity's `abstract contract` declarations are not directly supported. Use [interfaces](/guide/types#contract-interfaces) to define external contract APIs, or use base classes with [inheritance](/guide/inheritance) for shared logic.

## Custom NatSpec Tags

Skittles supports standard documentation comments (`@notice`, `@dev`, `@param`, `@return`), but other or custom NatSpec tags are not supported.

## Fixed-Point Numbers

Solidity's fixed-point number types (`fixed` and `ufixed`) are not supported. Solidity itself has limited support for these types, as they can be declared but not assigned to. Use `number` (`uint256`) with manual decimal scaling instead.

## User-Defined Value Types

Solidity's `type MyUint is uint256` syntax for creating distinct value types is not supported. Use standard types or type aliases instead.

## Function Selectors and ABI Introspection

Direct access to function selectors (`this.myFunction.selector`) and interface IDs (`type(MyInterface).interfaceId`) is not supported.

## Ternary Assignments in State

Ternary expressions (`condition ? a : b`) work in local variables and return statements, but they have limited support in certain complex contexts.

## Summary

| Solidity Feature | Supported | Alternative |
| --- | --- | --- |
| Modifiers | No | Use helper methods |
| Proxy / Upgradeable contracts | No | None |
| Inline assembly (YUL) | No | None |
| Libraries | No | Use exported functions or static methods |
| `delegatecall` / low-level calls | No | Use `Contract<T>()` for external calls |
| `create2` | No | None |
| `selfdestruct` | No | None (deprecated in Solidity) |
| `unchecked` blocks | No | None |
| Abstract contracts | No | Use interfaces or base classes |
| Fixed-point numbers | No | Use `number` with decimal scaling |
| User-defined value types | No | Use type aliases |
| Function selectors | No | None |
