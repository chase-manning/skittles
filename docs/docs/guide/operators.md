---
sidebar_position: 6
title: Operators
---

# Operators

Skittles supports all standard TypeScript operators. They work exactly as you'd expect and compile to their Solidity equivalents.

## Arithmetic Operators

| Operator | Description      | Example    |
| -------- | ---------------- | ---------- |
| `+`      | Addition         | `a + b`    |
| `-`      | Subtraction      | `a - b`    |
| `*`      | Multiplication   | `a * b`    |
| `/`      | Division         | `a / b`    |
| `%`      | Modulo           | `a % b`    |
| `**`     | Exponentiation   | `a ** b`   |

```typescript
class Math {
  public add(a: number, b: number): number {
    return a + b;
  }

  public power(base: number, exp: number): number {
    return base ** exp;
  }
}
```

:::note
Division is integer division — `7 / 2` gives `3`, not `3.5`. Solidity does not support floating-point numbers.
:::

## Comparison Operators

| Operator | Description              | Example    |
| -------- | ------------------------ | ---------- |
| `==`     | Equal                    | `a == b`   |
| `!=`     | Not equal                | `a != b`   |
| `>`      | Greater than             | `a > b`    |
| `<`      | Less than                | `a < b`    |
| `>=`     | Greater than or equal    | `a >= b`   |
| `<=`     | Less than or equal       | `a <= b`   |
| `===`    | Strict equal             | `a === b`  |
| `!==`    | Strict not equal         | `a !== b`  |

```typescript
class Comparison {
  public isGreater(a: number, b: number): boolean {
    return a > b;
  }

  public isEqual(a: number, b: number): boolean {
    return a === b;
  }
}
```

:::note
`===` and `!==` compile to `==` and `!=` in Solidity. Solidity has no strict equality distinction, so both forms behave identically.
:::

## Logical Operators

| Operator | Description | Example     |
| -------- | ----------- | ----------- |
| `&&`     | Logical AND | `a && b`    |
| `\|\|`   | Logical OR  | `a \|\| b`  |
| `!`      | Logical NOT | `!a`        |

```typescript
class Access {
  owner: address;
  active: boolean = true;

  public canAccess(caller: address): boolean {
    return caller == this.owner && this.active;
  }

  public isRestricted(): boolean {
    return !this.active;
  }
}
```

## Compound Assignment Operators

| Operator | Description              | Equivalent     |
| -------- | ------------------------ | -------------- |
| `+=`     | Add and assign           | `a = a + b`    |
| `-=`     | Subtract and assign      | `a = a - b`    |
| `*=`     | Multiply and assign      | `a = a * b`    |
| `/=`     | Divide and assign        | `a = a / b`    |
| `%=`     | Modulo and assign        | `a = a % b`    |
| `**=`    | Exponentiate and assign  | `a = a ** b`   |

```typescript
class Counter {
  count: number = 0;

  public increment(amount: number): void {
    this.count += amount;
  }

  public halve(): void {
    this.count /= 2;
  }
}
```

:::note
`**=` is desugared to `x = x ** y` because Solidity does not have a `**=` operator.
:::

## Increment / Decrement Operators

| Operator | Description       | Example  |
| -------- | ----------------- | -------- |
| `++`     | Increment by 1    | `a++`    |
| `--`     | Decrement by 1    | `a--`    |

```typescript
class Counter {
  count: number = 0;

  public increment(): void {
    this.count++;
  }

  public decrement(): void {
    this.count--;
  }
}
```

## Unary Operators

| Operator | Description | Example |
| -------- | ----------- | ------- |
| `-`      | Negation    | `-a`    |
| `+`      | Unary plus  | `+a`    |
| `~`      | Bitwise NOT | `~a`    |

## Operator Summary

Here's a quick reference of all supported operators grouped by category:

| Category            | Operators                                        |
| ------------------- | ------------------------------------------------ |
| Arithmetic          | `+` `-` `*` `/` `%` `**`                        |
| Comparison          | `==` `!=` `>` `<` `>=` `<=` `===` `!==`         |
| Logical             | `&&` `\|\|` `!`                                  |
| Compound Assignment | `+=` `-=` `*=` `/=` `%=` `**=`                  |
| Increment/Decrement | `++` `--`                                        |
| Unary               | `-` `+` `~`                                      |
| Bitwise             | `&` `\|` `^` `<<` `>>`                          |
| Bitwise Assignment  | `&=` `\|=` `^=` `<<=` `>>=`                     |
