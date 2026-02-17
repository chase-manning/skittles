---
sidebar_position: 4
title: Events and Errors
---

# Events and Errors

## Events

Declare events using `SkittlesEvent<T>` as a class property:

```typescript
import { address, SkittlesEvent, Indexed } from "skittles";

class Token {
  Transfer: SkittlesEvent<{
    from: Indexed<address>;
    to: Indexed<address>;
    value: number;
  }>;
}
```

```solidity title="Generated Solidity"
event Transfer(address indexed from, address indexed to, uint256 value);
```

### Indexed Parameters

Wrap parameter types with `Indexed<T>` to mark them as indexed in the event. Indexed parameters are stored in the event's topics and can be filtered by off chain indexers. Up to 3 parameters per event can be indexed.

```typescript
Transfer: SkittlesEvent<{
  from: Indexed<address>; // indexed
  to: Indexed<address>; // indexed
  value: number; // not indexed (stored in data)
}>;
```

### Emitting Events

Emit events using `this.EventName.emit(...)`. There are two syntaxes:

**Object literal syntax:**

```typescript
this.Transfer.emit({ from: msg.sender, to, value: amount });
```

**Positional argument syntax:**

```typescript
this.Transfer.emit(msg.sender, to, amount);
```

Both produce the same Solidity:

```solidity
emit Transfer(msg.sender, to, amount);
```

### Event Alias

You can also use `Event` as a shorter alias for `SkittlesEvent`:

```typescript
import { Event } from "skittles";

class Token {
  Transfer: Event<{ from: address; to: address; value: number }>;
}
```

## Custom Errors

Custom errors provide gas efficient revert reasons. There are two ways to declare them.

### SkittlesError Property

Declare errors as class properties using `SkittlesError<T>`:

```typescript
import { address, SkittlesError } from "skittles";

class Token {
  InsufficientBalance: SkittlesError<{
    sender: address;
    balance: number;
    required: number;
  }>;

  transfer(to: address, amount: number): void {
    if (this.balances[msg.sender] < amount) {
      throw this.InsufficientBalance(
        msg.sender,
        this.balances[msg.sender],
        amount,
      );
    }
    // ...
  }
}
```

```solidity title="Generated Solidity"
error InsufficientBalance(address sender, uint256 balance, uint256 required);

function transfer(address to, uint256 amount) public virtual {
    if (balances[msg.sender] < amount) {
        revert InsufficientBalance(msg.sender, balances[msg.sender], amount);
    }
    // ...
}
```

Throw custom errors with `throw this.ErrorName(args...)`.

### Error Class Pattern

Alternatively, declare errors as classes that extend `Error`:

```typescript
class InsufficientBalance extends Error {
  constructor(sender: address, balance: number, required: number) {}
}

class Token {
  transfer(to: address, amount: number): void {
    if (this.balances[msg.sender] < amount) {
      throw new InsufficientBalance(
        msg.sender,
        this.balances[msg.sender],
        amount,
      );
    }
  }
}
```

Both approaches generate the same Solidity `error` declaration and `revert` statement.

### Simple Reverts

For simple string reverts, use `throw new Error("message")`:

```typescript
if (amount == 0) {
  throw new Error("Amount must be greater than zero");
}
```

When this is the only statement in an `if` block with no `else`, it is automatically optimized to `require()`:

```solidity
require(amount != 0, "Amount must be greater than zero");
```

A bare `throw` without arguments generates `revert()`.
