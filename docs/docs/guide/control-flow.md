---
sidebar_position: 5
title: Control Flow
---

# Control Flow

Skittles supports all common control flow structures. They compile directly to their Solidity equivalents.

## If / Else

```typescript
if (amount > 0) {
  this.balances[to] += amount;
} else {
  throw new Error("Invalid amount");
}
```

```solidity title="Generated Solidity"
if (amount > 0) {
    balances[to] += amount;
} else {
    revert("Invalid amount");
}
```

## For Loops

Standard `for` loops:

```typescript
for (let i: number = 0; i < this.owners.length; i++) {
  this.balances[this.owners[i]] = 0;
}
```

```solidity title="Generated Solidity"
for (uint256 i = 0; i < owners.length; i++) {
    balances[owners[i]] = 0;
}
```

## For...of Loops

`for...of` loops over arrays are automatically desugared to index based `for` loops:

```typescript
for (const owner of this.owners) {
  this.balances[owner] = 0;
}
```

```solidity title="Generated Solidity"
for (uint256 _i_owner = 0; _i_owner < owners.length; _i_owner++) {
    address owner = owners[_i_owner];
    balances[owner] = 0;
}
```

## While Loops

```typescript
while (this.count > 0) {
  this.count -= 1;
}
```

## Do/While Loops

```typescript
do {
  this.count -= 1;
} while (this.count > 0);
```

## Break and Continue

Both `break` and `continue` are supported inside loops:

```typescript
for (let i: number = 0; i < this.owners.length; i++) {
  if (this.owners[i] == target) {
    break;
  }
  if (this.balances[this.owners[i]] == 0) {
    continue;
  }
  // ...
}
```

## Switch / Case

`switch` statements compile to `if`/`else if` chains in Solidity (since Solidity does not have a native `switch` statement):

```typescript
switch (status) {
  case VaultStatus.Active:
    this._processActive();
    break;
  case VaultStatus.Paused:
    this._processPaused();
    break;
  default:
    throw new Error("Unknown status");
}
```

```solidity title="Generated Solidity"
if (status == VaultStatus.Active) {
    _processActive();
} else if (status == VaultStatus.Paused) {
    _processPaused();
} else {
    revert("Unknown status");
}
```

`break` statements inside switch cases are automatically stripped (they are implicit in the `if`/`else` conversion).

## Ternary Operator

The conditional (ternary) operator compiles directly:

```typescript
let result: number = amount > 0 ? amount : 0;
```

```solidity title="Generated Solidity"
uint256 result = (amount > 0 ? amount : 0);
```

## Array Destructuring

Array destructuring is supported for local variable declarations:

```typescript
const [a, b, c] = [7, 8, 9];
```

This generates individual variable declarations:

```solidity title="Generated Solidity"
uint256 a = 7;
uint256 b = 8;
uint256 c = 9;
```

Conditional destructuring is also supported:

```typescript
let [x, y] = condition ? [a, b] : [b, a];
```

## Delete

The `delete` operator removes entries from mappings:

```typescript
delete this.balances[account];
```

```solidity title="Generated Solidity"
delete balances[account];
```
