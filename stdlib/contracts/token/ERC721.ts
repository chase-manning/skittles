import { address, msg, SkittlesEvent, SkittlesError, Indexed } from "skittles";
import { ZERO_ADDRESS } from "../constants.ts";

/**
 * Implementation of the ERC-721 non-fungible token standard.
 * Based on OpenZeppelin Contracts v5.
 *
 * Includes internal `_mint`, `_burn`, and `_transfer` functions that
 * child contracts can call, and a virtual `_update` hook for extensions.
 */
export class ERC721 {
  Transfer: SkittlesEvent<{
    from: Indexed<address>;
    to: Indexed<address>;
    tokenId: Indexed<number>;
  }>;
  Approval: SkittlesEvent<{
    owner: Indexed<address>;
    approved: Indexed<address>;
    tokenId: Indexed<number>;
  }>;
  ApprovalForAll: SkittlesEvent<{
    owner: Indexed<address>;
    operator: Indexed<address>;
    approved: boolean;
  }>;

  ERC721InvalidOwner: SkittlesError<{ owner: address }>;
  ERC721NonexistentToken: SkittlesError<{ tokenId: number }>;
  ERC721IncorrectOwner: SkittlesError<{
    sender: address;
    tokenId: number;
    owner: address;
  }>;
  ERC721InvalidSender: SkittlesError<{ sender: address }>;
  ERC721InvalidReceiver: SkittlesError<{ receiver: address }>;
  ERC721InsufficientApproval: SkittlesError<{
    operator: address;
    tokenId: number;
  }>;
  ERC721InvalidApprover: SkittlesError<{ approver: address }>;
  ERC721InvalidOperator: SkittlesError<{ operator: address }>;

  private _name: string;
  private _symbol: string;
  private _owners: Record<number, address> = {};
  private _balances: Record<address, number> = {};
  private _tokenApprovals: Record<number, address> = {};
  private _operatorApprovals: Record<address, Record<address, boolean>> = {};

  constructor(name_: string, symbol_: string) {
    this._name = name_;
    this._symbol = symbol_;
  }

  public name(): string {
    return this._name;
  }

  public symbol(): string {
    return this._symbol;
  }

  public balanceOf(owner: address): number {
    if (owner == ZERO_ADDRESS) {
      throw this.ERC721InvalidOwner(
        ZERO_ADDRESS
      );
    }
    return this._balances[owner];
  }

  public ownerOf(tokenId: number): address {
    return this._requireOwned(tokenId);
  }

  public approve(to: address, tokenId: number): void {
    this._approve(to, tokenId, msg.sender);
  }

  public getApproved(tokenId: number): address {
    this._requireOwned(tokenId);
    return this._tokenApprovals[tokenId];
  }

  public setApprovalForAll(operator: address, approved: boolean): void {
    this._setApprovalForAll(msg.sender, operator, approved);
  }

  public isApprovedForAll(owner: address, operator: address): boolean {
    return this._operatorApprovals[owner][operator];
  }

  public transferFrom(
    from: address,
    to: address,
    tokenId: number
  ): void {
    if (to == ZERO_ADDRESS) {
      throw this.ERC721InvalidReceiver(
        ZERO_ADDRESS
      );
    }
    let previousOwner: address = this._update(to, tokenId, msg.sender);
    if (previousOwner != from) {
      throw this.ERC721IncorrectOwner(from, tokenId, previousOwner);
    }
  }

  protected _ownerOf(tokenId: number): address {
    return this._owners[tokenId];
  }

  protected _getApproved(tokenId: number): address {
    return this._tokenApprovals[tokenId];
  }

  protected _isAuthorized(
    owner: address,
    spender: address,
    tokenId: number
  ): boolean {
    if (spender == ZERO_ADDRESS) {
      return false;
    }
    if (owner == spender) {
      return true;
    }
    if (this.isApprovedForAll(owner, spender)) {
      return true;
    }
    if (this.getApproved(tokenId) == spender) {
      return true;
    }
    return false;
  }

  protected _checkAuthorized(
    owner: address,
    spender: address,
    tokenId: number
  ): void {
    if (!this._isAuthorized(owner, spender, tokenId)) {
      if (owner == ZERO_ADDRESS) {
        throw this.ERC721NonexistentToken(tokenId);
      }
      throw this.ERC721InsufficientApproval(spender, tokenId);
    }
  }

  protected _update(
    to: address,
    tokenId: number,
    auth: address
  ): address {
    let from: address = this._ownerOf(tokenId);

    if (auth != ZERO_ADDRESS) {
      this._checkAuthorized(from, auth, tokenId);
    }

    if (from != ZERO_ADDRESS) {
      this._approve(
        ZERO_ADDRESS,
        tokenId,
        ZERO_ADDRESS
      );
      this._balances[from] -= 1;
    }

    if (to != ZERO_ADDRESS) {
      this._balances[to] += 1;
    }

    this._owners[tokenId] = to;

    this.Transfer.emit(from, to, tokenId);

    return from;
  }

  protected _mint(to: address, tokenId: number): void {
    if (to == ZERO_ADDRESS) {
      throw this.ERC721InvalidReceiver(
        ZERO_ADDRESS
      );
    }
    let previousOwner: address = this._update(
      to,
      tokenId,
      ZERO_ADDRESS
    );
    if (previousOwner != ZERO_ADDRESS) {
      throw this.ERC721InvalidSender(
        ZERO_ADDRESS
      );
    }
  }

  protected _burn(tokenId: number): void {
    let previousOwner: address = this._update(
      ZERO_ADDRESS,
      tokenId,
      ZERO_ADDRESS
    );
    if (previousOwner == ZERO_ADDRESS) {
      throw this.ERC721NonexistentToken(tokenId);
    }
  }

  protected _transfer(
    from: address,
    to: address,
    tokenId: number
  ): void {
    if (to == ZERO_ADDRESS) {
      throw this.ERC721InvalidReceiver(
        ZERO_ADDRESS
      );
    }
    let previousOwner: address = this._update(
      to,
      tokenId,
      ZERO_ADDRESS
    );
    if (previousOwner == ZERO_ADDRESS) {
      throw this.ERC721NonexistentToken(tokenId);
    }
    if (previousOwner != from) {
      throw this.ERC721IncorrectOwner(from, tokenId, previousOwner);
    }
  }

  protected _approve(
    to: address,
    tokenId: number,
    auth: address
  ): void {
    let tokenOwner: address = this._ownerOf(tokenId);
    if (tokenOwner == ZERO_ADDRESS) {
      throw this.ERC721NonexistentToken(tokenId);
    }
    if (auth != ZERO_ADDRESS) {
      if (
        auth != tokenOwner &&
        !this.isApprovedForAll(tokenOwner, auth)
      ) {
        throw this.ERC721InvalidApprover(auth);
      }
    }
    this._tokenApprovals[tokenId] = to;
    this.Approval.emit(tokenOwner, to, tokenId);
  }

  protected _setApprovalForAll(
    owner: address,
    operator: address,
    approved: boolean
  ): void {
    if (operator == ZERO_ADDRESS) {
      throw this.ERC721InvalidOperator(
        ZERO_ADDRESS
      );
    }
    this._operatorApprovals[owner][operator] = approved;
    this.ApprovalForAll.emit(owner, operator, approved);
  }

  protected _requireOwned(tokenId: number): address {
    let tokenOwner: address = this._ownerOf(tokenId);
    if (tokenOwner == ZERO_ADDRESS) {
      throw this.ERC721NonexistentToken(tokenId);
    }
    return tokenOwner;
  }
}
