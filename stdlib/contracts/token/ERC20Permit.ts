import { address, bytes32, block, SkittlesError, keccak256, ecrecover, abi, self } from "skittles";
import { ERC20 } from "./ERC20.ts";

/**
 * Extension of ERC-20 to support EIP-2612 permit (gasless approvals).
 * Based on OpenZeppelin Contracts v5.
 *
 * Allows token holders to approve spenders via off-chain signatures,
 * removing the need for a separate approval transaction.
 *
 * The generated Solidity uses `uint256` for the `v` parameter instead
 * of `uint8` due to Skittles type mapping. The `ecrecover` call
 * internally casts `v` to `uint8`.
 */
export class ERC20Permit extends ERC20 {
  ERC2612ExpiredSignature: SkittlesError<{ deadline: number }>;
  ERC2612InvalidSigner: SkittlesError<{ signer: address; owner: address }>;

  private _nonces: Record<address, number> = {};

  constructor(name_: string, symbol_: string) {
    super(name_, symbol_);
  }

  public nonces(owner: address): number {
    return this._nonces[owner];
  }

  public permit(
    owner: address,
    spender: address,
    value: number,
    deadline: number,
    v: number,
    r: bytes32,
    s: bytes32
  ): void {
    if (block.timestamp > deadline) {
      throw this.ERC2612ExpiredSignature(deadline);
    }
    let structHash: bytes32 = keccak256(
      abi.encode(
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
        owner,
        spender,
        value,
        this._useNonce(owner),
        deadline
      )
    );
    let hash: bytes32 = keccak256(
      abi.encodePacked("\x19\x01", this.DOMAIN_SEPARATOR(), structHash)
    );
    let signer: address = ecrecover(hash, v, r, s);
    if (signer != owner) {
      throw this.ERC2612InvalidSigner(signer, owner);
    }
    this._approve(owner, spender, value);
  }

  public DOMAIN_SEPARATOR(): bytes32 {
    return keccak256(
      abi.encode(
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
        keccak256(this.name()),
        keccak256("1"),
        block.chainid,
        self
      )
    );
  }

  protected _useNonce(owner: address): number {
    let current: number = this._nonces[owner];
    this._nonces[owner] = current + 1;
    return current;
  }
}
