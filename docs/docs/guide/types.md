---
sidebar_position: 1
title: Type System
---

# Type System

Skittles uses standard TypeScript types for your smart contracts, along with Ethereum types for addresses and binary data.

## Primitive Types

| TypeScript | Description |
| ---------- | ----------- |
| `number` | Used for amounts, counters and timestamps. Represents an unsigned whole number of up to 256 bits. |
| `string` | Used for names, symbols and text data. Represents UTF-8 encoded strings. |
| `boolean` | Used for flags and conditions, with values `true` or `false`. |

```typescript
class Example {
  count: number = 0;
  name: string = "hello";
  active: boolean = true;
}
```

### String Operations

Strings support `.length`, comparison operators and common methods with TypeScript-like syntax:

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

In the generated Solidity, `str.length` compiles to `bytes(str).length` and string comparisons use `keccak256` hashing, so you can write standard TypeScript comparisons.

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

Methods can also be chained together:

```typescript
public getUpperInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}
```

| Method | Description | Return Type |
| ------ | ----------- | ----------- |
| `str.charAt(index)` | Get the character at the given index | `string` |
| `str.substring(start, end)` | Extract part of the string from start to end | `string` |
| `str.toLowerCase()` | Convert the string to lowercase | `string` |
| `str.toUpperCase()` | Convert the string to uppercase | `string` |
| `str.startsWith(prefix)` | Check whether the string starts with the prefix | `boolean` |
| `str.endsWith(suffix)` | Check whether the string ends with the suffix | `boolean` |
| `str.trim()` | Remove leading and trailing spaces | `string` |
| `str.split(delimiter)` | Split the string by the delimiter | `string[]` |
| `str.replace(search, replacement)` | Replace the first occurrence of the search string | `string` |
| `str.replaceAll(search, replacement)` | Replace all occurrences of the search string | `string` |

:::note
String methods compile to internal helper functions that operate on bytes and are **not** full JavaScript or TypeScript implementations:

- They operate on ASCII bytes. Non-ASCII UTF-8 characters may behave unexpectedly (for example, `.length` counts bytes, not user-perceived characters).
- `charAt(index)` and `substring(start, end)` require in-range indices. If an index is out of bounds, or `start > end`, the call reverts instead of clamping or returning `""`.
- `substring(start)` without `end` is supported and defaults to the end of the string.
- Only the simple overloads shown above are supported: `startsWith(prefix)` and `endsWith(suffix)` without a position argument.
- `split(delimiter)` requires a non-empty delimiter. Using `split("")` (empty string) will revert.
- `replace(search, replacement)` and `replaceAll(search, replacement)` require a non-empty search string. Using an empty search string will revert. If the search string is not found, the original string is returned unchanged.
- `trim()` only removes ASCII space characters (code point 32) from the start and end of the string; it does not remove other whitespace characters.
:::

### Template Literals

Template literals (backtick strings) work as they do in TypeScript for strings and numbers:

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

Numbers are automatically converted to their string representation. Template literals compile to Solidity's `string.concat()`, with a generated `__sk_toString(uint256)` helper for numeric values. Using non-string, non-numeric values (such as `address` or `bool`) in template literals is not supported and will fail Solidity compilation.

## Ethereum Types

Import `address`, `bytes` and `bytes32` from `"skittles"`:

```typescript
import { address, bytes, bytes32 } from "skittles";

class Example {
  owner: address = msg.sender;
  data: bytes = "";
  commitment: bytes32 = keccak256(msg.sender);
}
```

| TypeScript | Description |
| ---------- | ----------- |
| `address` | Represents wallet addresses and contract addresses (20 bytes) |
| `bytes` | Represents raw binary data |
| `bytes32` | Fixed-size 32-byte value, used for hashes and storage keys |

Address literals are 42-character hex strings starting with `0x`:

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

This compiles to Solidity's `payable(to).transfer(amount)`, which sends the specified amount of wei and reverts if the transfer fails. The contract must have sufficient ETH balance to cover the transfer (for example, ETH received via a `receive()` function).

## Mappings

Use `Record<K, V>` or `Map<K, V>` for key-value storage on the blockchain (like a dictionary or map):

```typescript
import { address } from "skittles";

class Token {
  balances: Record<address, number> = {};

  allowances: Map<address, Map<address, number>> = {};
}
```

Both `Record` and `Map` compile to the same Solidity `mapping` type, so you can use whichever you prefer. Nested types create nested mappings. Mappings are used for storing balances, allowances and other key-value data that needs persistent storage.

### Map Methods

When using `Map<K, V>`, you can call standard Map methods:

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
| ------ | ----------- | ------------------- |
| `map.get(key)` | Get the value stored for a key | `mapping[key]` |
| `map.set(key, value)` | Set the value stored for a key | `mapping[key] = value` |
| `map.has(key)` | Check whether a key has a non-default value | `mapping[key] != 0` / `!= false` / `!= address(0)` |
| `map.delete(key)` | Delete a mapping entry | `delete mapping[key]` |

:::note
`map.has(key)` compares the stored value against the default value for the mapping's value type (`0` for numbers, `false` for booleans and `address(0)` for addresses). It is not supported for `string`, `bytes`, struct or nested mapping value types. For those types, use an explicit comparison instead.
:::

You can also use bracket notation directly on a `Map` or `Record`, as both styles work:

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

Skittles supports many TypeScript array methods that Solidity does not provide natively (along with a `remove(value)` helper), and generates the Solidity implementation at compile time.

### Adding & Removing Elements

```typescript
this.owners.push(newOwner);       // append to end
this.owners.pop();                // remove last element
this.owners.remove(addr);        // remove first occurrence (swap-and-pop)
this.owners.splice(1, 2);        // remove 2 elements starting at index 1
this.owners.reverse();            // reverse array in place
this.values.sort((a, b) => a - b); // sort ascending with comparator
```

### Searching

```typescript
this.owners.includes(addr);      // true if value exists
this.owners.indexOf(addr);       // index of first occurrence (type(uint256).max if not found)
this.owners.lastIndexOf(addr);   // index of last occurrence
this.values.at(0);               // element at index (supports negative: at(-1) = last)
```

### Iterating with Callbacks

Use arrow functions for array callbacks:

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

Use the spread operator (`...`) to combine arrays:

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

You can also spread storage arrays (state variables). The compiler copies them to memory:

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
- Only spread elements are supported: `[...a, ...b]`. Mixing spread and non-spread elements (for example, `[...a, 42]`) is not currently supported.
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
| `push(value)` | None | Yes | Append element |
| `pop()` | None | Yes | Remove last element |
| `remove(value)` | `boolean` | Yes | Remove first occurrence (swap-and-pop) |
| `splice(start, count)` | None | Yes | Remove elements at index |
| `reverse()` | None | Yes | Reverse in place |
| `sort(fn)` | None | Yes | Sort in place with comparator |
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
| `forEach(fn)` | None | Depends | Execute callback for each element |
| `slice(start, end)` | `T[]` | No | Copy sub-array |
| `concat(other)` | `T[]` | No | Combine two arrays |
| `[...a, ...b]` | `T[]` | No | Combine arrays with spread |
| `length` | `number` | No | Number of elements |

:::note
- `remove(value)` uses a **swap-and-pop** strategy to avoid shifting the remaining elements. It replaces the removed element with the last element, so array order is not preserved. If you need to keep the order, use `splice()` instead.
- `indexOf`, `lastIndexOf` and `findIndex` return `type(uint256).max` (a very large number) when no match is found, because Solidity uses unsigned integers.
- `find()` **reverts** if no element matches the condition, because Solidity cannot return `undefined`.
- `at(index)` **reverts** on out-of-bounds access, unlike JavaScript which returns `undefined`. Negative literal indices (such as `at(-1)`) are supported and rewritten at compile time, but negative non-literal indices are not supported.
- `slice(start, end)` and `splice(start, count)` have **stricter bounds** than JavaScript: they revert on invalid ranges instead of returning empty arrays or acting as no-ops. `slice` reverts if `start > end`, and `splice` requires `start < arr.length`. Negative indices are not supported for either method.
- `sort(fn)` uses **insertion sort** (O(n²) gas cost) and must be used as a standalone statement. It is only supported on `number[]` (uint256) and `int256[]` arrays. For `number[]` arrays, comparator parameters are cast to `int256` internally so subtraction patterns like `(a, b) => a - b` work without reverting on underflow. This cast is safe for values in the range `0` to `2^255 - 1`. Sorting an array that contains values `>= 2^255` reverts at the cast step. Because of its O(n²) gas cost, use it only on small arrays.
- Callback functions can only reference the callback parameter, literals and state variables. Referencing local variables from the enclosing function scope is not supported.
- All iteration-based methods (filter, map, some, every, find, findIndex, reduce, forEach) have O(n) gas cost, so keep array sizes in mind.
:::

### Readonly Arrays

Use `readonly` on array properties to prevent modification after initialisation. You can also use `ReadonlyArray<T>` or `readonly T[]` as the type:

```typescript
class Example {
  readonly admins: address[] = [];
  readonly config: ReadonlyArray<number> = [];
}
```

Readonly arrays compile to internal storage with a generated public getter function (such as `getAdmins()`). See [State Variables](/guide/state-variables#readonly-arrays) for more details.

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

Local variables inside functions can omit explicit types when the compiler can infer them:

```typescript
transfer(to: address, amount: number): boolean {
  const sender = msg.sender;    // inferred as address
  const balance = this.balances[sender]; // inferred as number
  const valid = amount > 0;     // inferred as boolean
  // ...
}
```

The compiler infers types from:

- Literal values: numbers from numeric literals, strings from string literals and booleans from `true` or `false`
- Global variables: `msg.sender` as `address` and `msg.value` as `number`
- Block properties: `block.timestamp` and `block.number` as `number`
- Property access on `this`: the type of the state variable
- Mapping and array access: the value type of the mapping or array
- Comparison operators: `boolean`

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
