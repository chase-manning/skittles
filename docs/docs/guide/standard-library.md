---
sidebar_position: 9
title: Standard Library
---

# Standard Library

Skittles ships with a built-in standard library of battle-tested contract implementations inspired by [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts). Import any contract and extend it — no extra packages or configuration required.

```typescript
import { ERC20, Ownable, AccessControl } from "skittles/contracts";
```

## Available Contracts

### Tokens

| Contract | Description |
|----------|-------------|
| **ERC20** | Full ERC-20 fungible token with mint, burn, approve, and transferFrom |
| **ERC20Permit** | ERC-20 extension with EIP-2612 gasless approvals via signatures |
| **ERC20Votes** | ERC-20 extension with token voting power delegation for governance |
| **ERC721** | Full ERC-721 non-fungible token with mint, burn, approvals, and operator support |

### Access Control

| Contract | Description |
|----------|-------------|
| **Ownable** | Single-owner access control with ownership transfer and renounce |
| **AccessControl** | Role-based access control with grant, revoke, and admin management |

### Security

| Contract | Description |
|----------|-------------|
| **Pausable** | Emergency pause mechanism for stopping contract operations |
| **ReentrancyGuard** | Protection against reentrancy attacks |

## ERC20

A complete ERC-20 token implementation. Extend it to create your own fungible token:

```typescript
import { address, msg } from "skittles";
import { ERC20 } from "skittles/contracts";

export class MyToken extends ERC20 {
  private _owner: address;

  constructor() {
    super("MyToken", "MTK");
    this._owner = msg.sender;
    this._mint(msg.sender, 1000000);
  }

  public mint(to: address, amount: number): void {
    if (msg.sender != this._owner) {
      throw new Error("Caller is not the owner");
    }
    this._mint(to, amount);
  }

  public burn(amount: number): void {
    this._burn(msg.sender, amount);
  }
}
```

### Public Functions

| Function | Description |
|----------|-------------|
| `name()` | Returns the token name |
| `symbol()` | Returns the token symbol |
| `decimals()` | Returns 18 |
| `totalSupply()` | Returns the total supply |
| `balanceOf(account)` | Returns the balance of an account |
| `transfer(to, value)` | Transfers tokens to an address |
| `allowance(owner, spender)` | Returns the remaining allowance |
| `approve(spender, value)` | Approves a spender to transfer tokens |
| `transferFrom(from, to, value)` | Transfers tokens using an allowance |

### Internal Functions (for extensions)

| Function | Description |
|----------|-------------|
| `_mint(to, value)` | Creates new tokens |
| `_burn(from, value)` | Destroys tokens |
| `_transfer(from, to, value)` | Internal transfer (validates addresses) |
| `_update(from, to, value)` | Core transfer hook (override for custom logic) |
| `_approve(owner, spender, value)` | Internal approval |
| `_spendAllowance(owner, spender, value)` | Internal allowance spending |

### Events

- `Transfer(from, to, value)` — emitted on transfer, mint, and burn
- `Approval(owner, spender, value)` — emitted on approval

### Custom Errors

- `ERC20InsufficientBalance(sender, balance, needed)`
- `ERC20InvalidSender(sender)`
- `ERC20InvalidReceiver(receiver)`
- `ERC20InsufficientAllowance(spender, allowance, needed)`
- `ERC20InvalidApprover(approver)`
- `ERC20InvalidSpender(spender)`

## ERC20Permit

An ERC-20 extension that supports [EIP-2612](https://eips.ethereum.org/EIPS/eip-2612) permit (gasless approvals). Token holders can approve spenders via off-chain signatures instead of on-chain transactions:

```typescript
import { address, msg } from "skittles";
import { ERC20Permit } from "skittles/contracts";

export class MyToken extends ERC20Permit {
  constructor() {
    super("MyToken", "MTK");
    this._mint(msg.sender, 1000000);
  }
}
```

Users can then call `permit()` with a signed message to approve token spending without the token holder paying gas.

### Public Functions

| Function | Description |
|----------|-------------|
| `name()` | Returns the token name |
| `symbol()` | Returns the token symbol |
| `decimals()` | Returns 18 |
| `totalSupply()` | Returns the total supply |
| `balanceOf(account)` | Returns the balance of an account |
| `transfer(to, value)` | Transfers tokens to an address |
| `allowance(owner, spender)` | Returns the remaining allowance |
| `approve(spender, value)` | Approves a spender to transfer tokens |
| `transferFrom(from, to, value)` | Transfers tokens using an allowance |
| `nonces(owner)` | Returns the current nonce for an owner |
| `permit(owner, spender, value, deadline, v, r, s)` | Approves via EIP-712 signature |
| `DOMAIN_SEPARATOR()` | Returns the EIP-712 domain separator |

### Internal Functions (for extensions)

| Function | Description |
|----------|-------------|
| `_mint(to, value)` | Creates new tokens |
| `_burn(from, value)` | Destroys tokens |
| `_useNonce(owner)` | Consumes and returns the current nonce |

### Events

- `Transfer(from, to, value)` — emitted on transfer, mint, and burn
- `Approval(owner, spender, value)` — emitted on approval

### Custom Errors

- `ERC2612ExpiredSignature(deadline)` — permit deadline has passed
- `ERC2612InvalidSigner(signer, owner)` — recovered signer doesn't match owner
- `ECDSAInvalidSignature()` — signature recovery returned the zero address
- All ERC20 custom errors are also available

## ERC20Votes

An ERC-20 extension that supports token-based voting and delegation. Token holders can delegate their voting power to any address, and voting power is tracked automatically on transfers.

> **Note:** This is a simplified, current-votes-only implementation. It does **not** implement EIP-5805-style checkpointing and does **not** support historical vote lookups such as `getPastVotes`. It is not a drop-in replacement for OpenZeppelin's ERC20Votes.

```typescript
import { address, msg } from "skittles";
import { ERC20Votes } from "skittles/contracts";

export class GovernanceToken extends ERC20Votes {
  constructor() {
    super("GovToken", "GOV");
    this._mint(msg.sender, 1000000);
  }
}
```

Users must delegate (even to themselves) to activate voting power. Tokens held by accounts that have not delegated do not count as votes.

### Public Functions

| Function | Description |
|----------|-------------|
| `name()` | Returns the token name |
| `symbol()` | Returns the token symbol |
| `decimals()` | Returns 18 |
| `totalSupply()` | Returns the total supply |
| `balanceOf(account)` | Returns the balance of an account |
| `transfer(to, value)` | Transfers tokens to an address |
| `allowance(owner, spender)` | Returns the remaining allowance |
| `approve(spender, value)` | Approves a spender to transfer tokens |
| `transferFrom(from, to, value)` | Transfers tokens using an allowance |
| `delegates(account)` | Returns the delegate for an account |
| `getVotes(account)` | Returns the current voting power |
| `delegate(delegatee)` | Delegates voting power to an address |

### Internal Functions (for extensions)

| Function | Description |
|----------|-------------|
| `_mint(to, value)` | Creates new tokens |
| `_burn(from, value)` | Destroys tokens |
| `_delegate(account, delegatee)` | Internal delegation |
| `_moveDelegateVotes(from, to, amount)` | Moves voting power between delegates |
| `_update(from, to, value)` | Core transfer hook (moves delegate votes on transfer) |

### Events

- `Transfer(from, to, value)` — emitted on transfer, mint, and burn
- `Approval(owner, spender, value)` — emitted on approval
- `DelegateChanged(delegator, fromDelegate, toDelegate)` — emitted when delegation changes
- `DelegateVotesChanged(delegate, previousVotes, newVotes)` — emitted when voting power changes

## ERC721

A complete ERC-721 non-fungible token implementation:

```typescript
import { address, msg } from "skittles";
import { ERC721 } from "skittles/contracts";

export class MyNFT extends ERC721 {
  private nextTokenId: number = 0;
  private _owner: address;

  constructor() {
    super("MyNFT", "MNFT");
    this._owner = msg.sender;
  }

  public mint(to: address): number {
    if (msg.sender != this._owner) {
      throw new Error("Caller is not the owner");
    }
    let tokenId: number = this.nextTokenId;
    this.nextTokenId += 1;
    this._mint(to, tokenId);
    return tokenId;
  }
}
```

### Public Functions

| Function | Description |
|----------|-------------|
| `name()` | Returns the collection name |
| `symbol()` | Returns the collection symbol |
| `balanceOf(owner)` | Returns the number of tokens owned |
| `ownerOf(tokenId)` | Returns the owner of a token |
| `transferFrom(from, to, tokenId)` | Transfers a token |
| `approve(to, tokenId)` | Approves an address for a token |
| `getApproved(tokenId)` | Returns the approved address for a token |
| `setApprovalForAll(operator, approved)` | Approves an operator for all tokens |
| `isApprovedForAll(owner, operator)` | Checks if an operator is approved |

### Internal Functions (for extensions)

| Function | Description |
|----------|-------------|
| `_mint(to, tokenId)` | Mints a new token |
| `_burn(tokenId)` | Burns a token |
| `_transfer(from, to, tokenId)` | Internal transfer |
| `_update(to, tokenId, auth)` | Core transfer hook |

## Ownable

Single-owner access control. Since Skittles doesn't have Solidity-style modifiers, call `_checkOwner()` at the start of restricted functions:

```typescript
import { address, msg } from "skittles";
import { Ownable } from "skittles/contracts";

export class Treasury extends Ownable {
  private balance: number = 0;

  constructor() {
    super(msg.sender);
  }

  public withdraw(amount: number): void {
    this._checkOwner();
    this.balance -= amount;
  }
}
```

### Functions

| Function | Description |
|----------|-------------|
| `owner()` | Returns the current owner |
| `transferOwnership(newOwner)` | Transfers ownership (owner only) |
| `renounceOwnership()` | Renounces ownership (owner only) |
| `_checkOwner()` | Reverts if caller is not the owner |
| `_transferOwnership(newOwner)` | Internal ownership transfer |

## AccessControl

Role-based access control for contracts that need more than a single owner. Define roles as `bytes32` constants and use `_checkRole(role)` to restrict functions:

```typescript
import { address, bytes32, msg, keccak256 } from "skittles";
import { AccessControl } from "skittles/contracts";

export class Treasury extends AccessControl {
  static readonly TREASURER_ROLE: bytes32 = keccak256("TREASURER_ROLE");

  private balance: number = 0;

  constructor() {
    super();
    this._grantRole(AccessControl.DEFAULT_ADMIN_ROLE, msg.sender);
    this._grantRole(Treasury.TREASURER_ROLE, msg.sender);
  }

  public withdraw(amount: number): void {
    this._checkRole(Treasury.TREASURER_ROLE);
    this.balance -= amount;
  }
}
```

Every role has an admin role that controls who can grant and revoke it. By default the admin role for all roles is `DEFAULT_ADMIN_ROLE` (bytes32 zero).

### Functions

| Function | Description |
|----------|-------------|
| `hasRole(role, account)` | Returns whether an account has a role |
| `getRoleAdmin(role)` | Returns the admin role for a given role |
| `grantRole(role, account)` | Grants a role (caller must have the role's admin role) |
| `revokeRole(role, account)` | Revokes a role (caller must have the role's admin role) |
| `renounceRole(role, callerConfirmation)` | Renounces own role (pass your own address as confirmation) |
| `_checkRole(role)` | Reverts if caller does not have the role |
| `_grantRole(role, account)` | Internal role grant |
| `_revokeRole(role, account)` | Internal role revoke |
| `_setRoleAdmin(role, adminRole)` | Internal admin role change |

## Pausable

Emergency stop mechanism. Call `_requireNotPaused()` in functions that should be disabled when paused:

```typescript
import { address, msg } from "skittles";
import { Pausable } from "skittles/contracts";

export class Vault extends Pausable {
  private _owner: address;

  constructor() {
    super();
    this._owner = msg.sender;
  }

  public deposit(amount: number): void {
    this._requireNotPaused();
    // deposit logic
  }

  public pause(): void {
    if (msg.sender != this._owner) {
      throw new Error("Caller is not the owner");
    }
    this._pause();
  }

  public unpause(): void {
    if (msg.sender != this._owner) {
      throw new Error("Caller is not the owner");
    }
    this._unpause();
  }
}
```

### Functions

| Function | Description |
|----------|-------------|
| `paused()` | Returns whether the contract is paused |
| `_requireNotPaused()` | Reverts if paused |
| `_requirePaused()` | Reverts if not paused |
| `_pause()` | Pauses the contract |
| `_unpause()` | Unpauses the contract |

## ReentrancyGuard

Protection against reentrancy attacks. Call `_nonReentrantBefore()` at the start of protected functions and `_nonReentrantAfter()` at the end:

```typescript
import { address, msg } from "skittles";
import { ReentrancyGuard } from "skittles/contracts";

export class Vault extends ReentrancyGuard {
  public withdraw(amount: number): void {
    this._nonReentrantBefore();
    // withdrawal logic
    this._nonReentrantAfter();
  }
}
```

### Functions

| Function | Description |
|----------|-------------|
| `_nonReentrantBefore()` | Locks the reentrancy guard |
| `_nonReentrantAfter()` | Unlocks the reentrancy guard |
| `_reentrancyGuardEntered()` | Returns whether the guard is locked |

## Combining Contracts

You can combine multiple base contracts in a single file. Since TypeScript only supports single inheritance with `extends`, compose contracts by using one as the base and adding others' patterns manually:

```typescript
import { address, msg } from "skittles";
import { ERC20 } from "skittles/contracts";

export class MyToken extends ERC20 {
  private _owner: address;

  constructor() {
    super("MyToken", "MTK");
    this._owner = msg.sender;
    this._mint(msg.sender, 1000000);
  }

  public mint(to: address, amount: number): void {
    if (msg.sender != this._owner) {
      throw new Error("Caller is not the owner");
    }
    this._mint(to, amount);
  }
}
```

## How It Works

When you extend a standard library contract, the Skittles compiler:

1. Detects `extends ERC20` (or any stdlib contract) in your code
2. Automatically includes the stdlib contract source in compilation
3. Generates separate Solidity files with proper `import` statements
4. Both the stdlib `.sol` and your contract `.sol` are output to the artifacts directory

The generated Solidity uses standard inheritance — your contract compiles to standalone Solidity with no external dependencies.
