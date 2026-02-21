---
sidebar_position: 4
title: Events and Errors
---

# Events and Errors

## Events

Events are like logs that your contract emits when something important happens. External applications (wallets, explorers, dApps) can listen for these events to track contract activity.

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

### Indexed Parameters

Indexed parameters can be used to filter and search for specific events. For example, you can search for all Transfer events involving a specific address.

Wrap parameter types with `Indexed<T>` to mark them as indexed in the event. Up to 3 parameters per event can be indexed.

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

### Event Alias

You can also use `Event` as a shorter alias for `SkittlesEvent`:

```typescript
import { Event } from "skittles";

class Token {
  Transfer: Event<{ from: address; to: address; value: number }>;
}
```

## Custom Errors

Custom errors give clear, structured error messages when something goes wrong. They're more informative and cost less gas than simple string messages.

There are two ways to declare them.

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

### Simple Reverts

Use `throw new Error('message')` for simple error messages:

```typescript
if (amount == 0) {
  throw new Error("Amount must be greater than zero");
}
```

A bare `throw` stops execution immediately.
