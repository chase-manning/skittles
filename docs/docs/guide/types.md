---
sidebar_position: 1
title: Type System
---

# Type System

Skittles uses familiar TypeScript types for your smart contracts. Here's how to use them.

## Primitive Types

| TypeScript | Description                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| `number`   | Used for amounts, counters, timestamps — represents a whole number (unsigned, up to 256 bits)           |
| `string`   | Used for names, symbols, text data — UTF-8 encoded strings                                               |
| `boolean`  | Used for flags and conditions — `true` or `false`                                                        |

```typescript
class Example {
  count: number = 0;
  name: string = "hello";
  active: boolean = true;
}
```

### String Operations

Strings support `.length`, comparison operators, and common methods with TypeScript-like syntax:

```typescript
class Example {
  public name: string = "hello";

  public getNameLength(): number {
    return this.name.length;
  }

  public isHello(text: string): boolean {
    return text === "hello";
  }

  public isDifferent(a: string, b: string): boolean {
    return a !== b;
  }
}
```

Under the hood, `str.length` compiles to `bytes(str).length` and string comparisons use `keccak256` hashing — but you don't need to worry about that. Just write natural TypeScript.

### String Methods

Common string methods are supported:

```typescript
class StringExample {
  public getInitial(name: string): string {
    return name.charAt(0);
  }

  public getSlice(text: string): string {
    return text.substring(0, 5);
  }

  public normalize(text: string): string {
    return text.toLowerCase();
  }

  public checkPrefix(text: string, prefix: string): boolean {
    return text.startsWith(prefix);
  }

  public clean(text: string): string {
    return text.trim();
  }

  public tokenize(csv: string): string[] {
    return csv.split(",");
  }

  public sanitize(input: string): string {
    return input.replaceAll(" ", "_");
  }

  public replaceFirst(text: string, from: string, to: string): string {
    return text.replace(from, to);
  }
}
```

Methods can be chained:

```typescript
public getUpperInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}
```

| Method | Description | Return Type |
|--------|-------------|-------------|
| `str.charAt(index)` | Get character at index | `string` |
| `str.substring(start, end)` | Extract part of string | `string` |
| `str.toLowerCase()` | Convert to lowercase | `string` |
| `str.toUpperCase()` | Convert to uppercase | `string` |
| `str.startsWith(prefix)` | Check if string starts with prefix | `boolean` |
| `str.endsWith(suffix)` | Check if string ends with suffix | `boolean` |
| `str.trim()` | Remove leading/trailing spaces | `string` |
| `str.split(delimiter)` | Split string by delimiter | `string[]` |
| `str.replace(search, replacement)` | Replace first occurrence | `string` |
| `str.replaceAll(search, replacement)` | Replace all occurrences | `string` |

:::note
String methods compile to internal helper functions that operate on bytes and are **not** full JavaScript/TypeScript implementations:

- They operate on ASCII bytes. Non-ASCII UTF-8 characters may behave unexpectedly (for example, `.length` counts bytes, not user-perceived characters).
- `charAt(index)` and `substring(start, end)` require in-range indices. If an index is out of bounds, or `start > end`, the call reverts instead of clamping or returning `""`.
- `substring(start)` without `end` is supported and defaults to the end of the string.
- Only the simple overloads shown above are supported: `startsWith(prefix)` and `endsWith(suffix)` without a position argument.
- `split(delimiter)` requires a non-empty delimiter. Using `split("")` (empty string) will revert.
- `replace(search, replacement)` and `replaceAll(search, replacement)` require a non-empty search string. Using an empty search string will revert. If the search string is not found, the original string is returned unchanged.
- `trim()` only removes ASCII space characters (code point 32) from the start and end of the string; it does not remove other whitespace characters.
:::

### Template Literals

Template literals (backtick strings) work just like in TypeScript:

```typescript
class Token {
  private supply: number = 0;

  public greet(name: string): string {
    return `Hello ${name}`;
  }

  public label(tokenId: number): string {
    return `Token #${tokenId}`;
  }

  public info(name: string, balance: number): string {
    return `${name} has ${balance} tokens`;
  }

  public supplyInfo(): string {
    return `Supply: ${this.supply}`;
  }
}
```

Numbers are automatically converted to their string representation. Under the hood, template literals compile to Solidity's `string.concat()` with a generated `__sk_toString(uint256)` helper for numeric values. Using non-string, non-numeric values (such as `address` or `bool`) in template literals is not supported and will fail Solidity compilation.

## Ethereum Types

Import `address`, `bytes`, and `bytes32` from `"skittles"`:

```typescript
import { address, bytes, bytes32 } from "skittles";

class Example {
  owner: address = msg.sender;
  data: bytes = "";
  commitment: bytes32 = keccak256(msg.sender);
}
```

| TypeScript | Description                                                   |
| ---------- | ------------------------------------------------------------- |
| `address`  | Represents wallet addresses and contract addresses (20 bytes) |
| `bytes`    | Represents raw binary data                                    |
| `bytes32`  | Fixed-size 32-byte value, used for hashes and storage keys    |

Address literals are 42 character hex strings starting with `0x`:

```typescript
const zero: address = "0x0000000000000000000000000000000000000000";
```

### Sending ETH

Use `.transfer(amount)` on any address to send ETH (in wei) from the contract:

```typescript
class Wallet {
  public withdraw(to: address, amount: number): void {
    to.transfer(amount);
  }
}
```

This compiles to Solidity's `payable(to).transfer(amount)`, which sends the specified amount of wei and reverts if the transfer fails. The contract must have sufficient ETH balance (e.g. received via a `receive()` function).

## Mappings

Use `Record<K, V>` or `Map<K, V>` for key-value storage on the blockchain (like a dictionary or map):

```typescript
import { address } from "skittles";

class Token {
  balances: Record<address, number> = {};

  allowances: Map<address, Map<address, number>> = {};
}
```

Both `Record` and `Map` compile to the same Solidity `mapping` type, so use whichever feels more natural. Nested types create nested mappings. This is perfect for storing balances, allowances, and other key-value data that needs persistent storage.

### Map Methods

When using `Map<K, V>`, you can use standard Map methods for a more TypeScript-idiomatic experience:

```typescript
class Token {
  private balances: Map<address, number> = {};

  public setBalance(addr: address, amount: number): void {
    this.balances.set(addr, amount);      // mapping[key] = value
  }

  public getBalance(addr: address): number {
    return this.balances.get(addr);       // mapping[key]
  }

  public hasBalance(addr: address): boolean {
    return this.balances.has(addr);       // mapping[key] != 0
  }

  public removeBalance(addr: address): void {
    this.balances.delete(addr);           // delete mapping[key]
  }
}
```

| Method | Description | Solidity Equivalent |
|--------|-------------|-------------------|
| `map.get(key)` | Get value | `mapping[key]` |
| `map.set(key, value)` | Set value | `mapping[key] = value` |
| `map.has(key)` | Check if key has non-default value | `mapping[key] != 0` / `!= false` / `!= address(0)` |
| `map.delete(key)` | Delete a mapping entry | `delete mapping[key]` |

:::note
`map.has(key)` compares against the default value for the mapping's value type (`0` for numbers, `false` for booleans, `address(0)` for addresses). It is not supported for `string`, `bytes`, struct, or nested mapping value types — use an explicit comparison instead.
:::

You can also use bracket notation directly — both styles work:

```typescript
this.balances[addr] = amount;   // same as this.balances.set(addr, amount)
return this.balances[addr];     // same as this.balances.get(addr)
delete this.balances[addr];     // same as this.balances.delete(addr)
```

## Arrays

Use `T[]` for dynamic arrays:

```typescript
class Example {
  owners: address[] = [];
  values: number[] = [];
}
```

Skittles supports a rich set of TypeScript array methods — far beyond what Solidity offers natively. Just write natural TypeScript and the compiler handles the rest.

### Adding & Removing Elements

```typescript
this.owners.push(newOwner);       // append to end
this.owners.pop();                // remove last element
this.owners.remove(addr);        // remove first occurrence (swap-and-pop)
this.owners.splice(1, 2);        // remove 2 elements starting at index 1
this.owners.reverse();            // reverse array in place
```

### Searching

```typescript
this.owners.includes(addr);      // true if value exists
this.owners.indexOf(addr);       // index of first occurrence (type(uint256).max if not found)
this.owners.lastIndexOf(addr);   // index of last occurrence
this.values.at(0);               // element at index (supports negative: at(-1) = last)
```

### Iterating with Callbacks

Use arrow functions just like in TypeScript:

```typescript
// Check if any/all elements match a condition
const hasAdmin = this.values.some(v => v > 100);
const allPositive = this.values.every(v => v > 0);

// Find elements
const first = this.values.find(v => v > 50);
const idx = this.values.findIndex(v => v > 50);

// Accumulate
const total = this.values.reduce((acc, v) => acc + v, 0);
```

### Transforming Arrays

These methods return new arrays (in memory):

```typescript
// Filter elements
const large = this.values.filter(v => v > 10);

// Transform elements
const doubled = this.values.map(v => v * 2);

// Extract a sub-array
const middle = this.values.slice(1, 3);

// Combine arrays
const combined = this.values.concat(otherArray);
```

### Spread Operator

Use the spread operator (`...`) to combine arrays — just like in TypeScript:

```typescript
class Example {
  public combineArrays(a: number[], b: number[]): number[] {
    return [...a, ...b];
  }
}
```

Spread works with any number of arrays:

```typescript
return [...arr1, ...arr2, ...arr3];
```

You can also spread storage arrays (state variables). The compiler automatically copies them to memory:

```typescript
class Example {
  private items1: number[] = [];
  private items2: number[] = [];

  public combined(): number[] {
    return [...this.items1, ...this.items2];
  }
}
```

:::note
- Only spread elements are supported: `[...a, ...b]`. Mixing spread and non-spread elements (e.g. `[...a, 42]`) is not currently supported.
- Spread creates a new memory array, so it has O(n) gas cost where n is the total number of elements.
:::

### Side Effects

```typescript
this.values.forEach(v => this.total += v);
```

### Array Length & Access

```typescript
const len = this.owners.length;
const first = this.owners[0];

for (let i: number = 0; i < this.owners.length; i++) {
  // ...
}

for (const owner of this.owners) {
  // ...
}
```

### Method Reference

| Method | Returns | Mutates | Description |
|--------|---------|---------|-------------|
| `push(value)` | — | Yes | Append element |
| `pop()` | — | Yes | Remove last element |
| `remove(value)` | `boolean` | Yes | Remove first occurrence (swap-and-pop) |
| `splice(start, count)` | — | Yes | Remove elements at index |
| `reverse()` | — | Yes | Reverse in place |
| `includes(value)` | `boolean` | No | Check if value exists |
| `indexOf(value)` | `number` | No | First index of value |
| `lastIndexOf(value)` | `number` | No | Last index of value |
| `at(index)` | `T` | No | Element at index (negative = from end) |
| `some(fn)` | `boolean` | No | True if any element matches |
| `every(fn)` | `boolean` | No | True if all elements match |
| `find(fn)` | `T` | No | First matching element (reverts if none) |
| `findIndex(fn)` | `number` | No | Index of first match (`type(uint256).max` if none) |
| `filter(fn)` | `T[]` | No | New array of matching elements |
| `map(fn)` | `U[]` | No | New array with transformed elements |
| `reduce(fn, init)` | `U` | No | Accumulate to single value |
| `forEach(fn)` | — | Depends | Execute callback for each element |
| `slice(start, end)` | `T[]` | No | Copy sub-array |
| `concat(other)` | `T[]` | No | Combine two arrays |
| `[...a, ...b]` | `T[]` | No | Combine arrays with spread |
| `length` | `number` | No | Number of elements |

:::note
- `remove(value)` uses a **swap-and-pop** strategy for gas efficiency — the removed element is replaced with the last element, so array order is not preserved. If you need ordered removal, use `splice()` instead.
- `indexOf`, `lastIndexOf`, and `findIndex` return `type(uint256).max` (a very large number) when no match is found, since Solidity uses unsigned integers.
- `find()` **reverts** if no element matches the condition, since Solidity cannot return `undefined`.
- `at(index)` **reverts** on out-of-bounds access (unlike JavaScript which returns `undefined`). Negative literal indices (e.g., `at(-1)`) are supported and desugared at compile time, but negative non-literal indices are not supported.
- `slice(start, end)` and `splice(start, count)` have **stricter bounds** than JavaScript: they revert on invalid ranges instead of returning empty arrays or acting as no-ops. Specifically, `slice` reverts if `start > end`, and `splice` requires `start < arr.length`. Negative indices are not supported for either method.
- Callback functions should only reference the callback parameter and literals or state variables. Referencing local variables from the enclosing function scope is not supported.
- All iteration-based methods (filter, map, some, every, find, findIndex, reduce, forEach) have O(n) gas cost. Be mindful of array sizes.
:::

### Readonly Arrays

Use `readonly` on array properties to prevent modification after initialization. You can also use `ReadonlyArray<T>` or `readonly T[]` as the type:

```typescript
class Example {
  readonly admins: address[] = [];
  readonly config: ReadonlyArray<number> = [];
}
```

Readonly arrays compile to internal storage with an auto-generated public getter function (e.g., `getAdmins()`). See [State Variables](/guide/state-variables#readonly-arrays) for more details.

## Structs

Use TypeScript type aliases with object shapes to define custom data structures:

```typescript title="contracts/types.ts"
import { address } from "skittles";

export type StakeInfo = {
  amount: number;
  timestamp: number;
  account: address;
};
```

Struct instances are created with object literals:

```typescript
let info: StakeInfo = {
  amount: this.deposits[account],
  timestamp: this.depositTimestamps[account],
  account: account,
};
return info;
```

Structs can be shared across contract files. See [Cross File Support](/guide/cross-file).

## Contract Interfaces

Use TypeScript interfaces to define the external API shape of a contract:

```typescript title="contracts/interfaces.ts"
import { address } from "skittles";

export interface IToken {
  name: string;
  symbol: string;
  totalSupply: number;
  balanceOf(account: address): number;
  transfer(to: address, amount: number): boolean;
}
```

Properties represent getter functions. Methods represent callable functions.

### Implementing Interfaces

Use the `implements` keyword to implement an interface:

```typescript title="contracts/Token.ts"
class Token implements IToken {
  public name: string = "MyToken";
  public symbol: string = "MTK";
  public totalSupply: number = 1000000;
  private balances: Record<address, number> = {};

  public balanceOf(account: address): number {
    return this.balances[account];
  }

  public transfer(to: address, amount: number): boolean {
    this.balances[msg.sender] -= amount;
    this.balances[to] += amount;
    return true;
  }
}
```

Interfaces can be shared across contract files. See [Cross File Support](/guide/cross-file).

## Enums

TypeScript enums define a set of named constants:

```typescript title="contracts/types.ts"
export enum VaultStatus {
  Active,
  Paused,
}
```

Use them as state variable types and in comparisons:

```typescript
class Staking {
  public status: VaultStatus;

  public pause(): void {
    this.status = VaultStatus.Paused;
  }

  private _requireActive(): void {
    if (this.status == VaultStatus.Paused) {
      throw this.VaultPaused();
    }
  }
}
```

Enums can be shared across contract files. See [Cross File Support](/guide/cross-file).

You can iterate over all values of an enum using `for...in`:

```typescript
for (const status in VaultStatus) {
  // Runs for each enum member
}
```

## Type Inference

Local variables inside functions can omit explicit types when the type can be inferred:

```typescript
transfer(to: address, amount: number): boolean {
  const sender = msg.sender;    // inferred as address
  const balance = this.balances[sender]; // inferred as number
  const valid = amount > 0;     // inferred as boolean
  // ...
}
```

The compiler infers types from:

- Literal values: numbers are inferred from numeric literals, strings from string literals, booleans from `true`/`false`
- Global variables: `msg.sender` is inferred as `address`, `msg.value` as `number`
- Block properties: `block.timestamp` and `block.number` are inferred as `number`
- Property access on `this` → the type of the state variable
- Mapping/array access → the value type of the mapping/array
- Comparison operators → `boolean`

Function parameters and return types must always be explicitly typed.

## Tuples

Use TypeScript tuple types to return multiple values from a function:

```typescript
class Pair {
  private reserve0: number = 0;
  private reserve1: number = 0;

  getReserves(): [number, number, number] {
    return [this.reserve0, this.reserve1, block.timestamp];
  }
}
```

Tuples can contain any combination of supported types. See [Functions](/guide/functions#multiple-return-values) for more details.

## Void

Functions that return nothing use `void`:

```typescript
transfer(to: address, amount: number): void {
  // No return statement needed
}
```
