---
sidebar_position: 5
title: Control Flow
---

# Control Flow

Skittles supports all standard TypeScript control flow patterns. Use them exactly as you would in any TypeScript project.

## If / Else

```typescript
if (amount > 0) {
  this.balances[to] += amount;
} else {
  throw new Error("Invalid amount");
}
```

## For Loops

Standard `for` loops:

```typescript
for (let i: number = 0; i < this.owners.length; i++) {
  this.balances[this.owners[i]] = 0;
}
```

## For...of Loops

`for...of` loops work on arrays:

```typescript
for (const owner of this.owners) {
  this.balances[owner] = 0;
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

## Ternary Operator

The conditional (ternary) operator:

```typescript
let result: number = amount > 0 ? amount : 0;
```

## Array Destructuring

Array destructuring is supported for local variable declarations:

```typescript
const [a, b, c] = [7, 8, 9];
```

Conditional destructuring is also supported:

```typescript
let [x, y] = condition ? [a, b] : [b, a];
```

## Object Destructuring

Object destructuring is supported for struct fields:

```typescript
const { amount, timestamp } = this.getStakeInfo(account);
```

Direct object literal destructuring also works:

```typescript
const { a, b } = { a: 1, b: 2 };
```

## Delete

The `delete` operator resets values in your contract's storage (useful for clearing mapping entries):

```typescript
delete this.balances[account];
```

## Try / Catch

Use `try/catch` to gracefully handle failures from external contract calls. The first statement in the `try` block must be an external contract call:

```typescript
try {
  const balance: number = this.token.balanceOf(account);
  this.lastBalance = balance;
} catch (e) {
  this.lastBalance = 0;
}
```

If the external call fails, execution jumps to the `catch` block. This is useful for composable DeFi protocols that need to handle failures in other contracts.

You can also use `try/catch` without capturing a return value:

```typescript
try {
  this.token.transfer(to, amount);
} catch (e) {
  this.failed = true;
}
```
