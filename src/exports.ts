/**
 * Public API exports for the skittles package.
 * Users import from "skittles" in their contract files and config.
 */

// Config type (for skittles.config.json / skittles.config.js)
export type { SkittlesConfig } from "./types/index.ts";

// Ethereum primitive types (for contract files)
import type { address, bytes, bytes32 } from "./types/index.ts";
export type { address, bytes, bytes32 };

/**
 * Event type for declaring Solidity events in Skittles contracts.
 * Both `SkittlesEvent` and `Event` are recognized by the compiler parser.
 *
 * Usage: `Transfer: SkittlesEvent<{ from: address; to: address; value: number }>;`
 * Emit:  `this.Transfer.emit({ from: sender, to: receiver, value: amount });`
 */
export interface SkittlesEvent<
  _T extends Record<string, unknown> = Record<string, unknown>,
> {
  emit(data: _T): void;
  emit(...args: unknown[]): void;
}

// Convenience alias
export type Event<
  _T extends Record<string, unknown> = Record<string, unknown>,
> = SkittlesEvent<_T>;

/**
 * Error type for declaring Solidity custom errors in Skittles contracts.
 *
 * Usage: `NotOwner: SkittlesError<{ caller: address }>;`
 * Throw: `throw this.NotOwner(msg.sender);`
 */
export type SkittlesError<
  _T extends Record<string, unknown> = Record<string, unknown>,
> = (...args: unknown[]) => never;

/**
 * Wrapper type to mark an event parameter as indexed.
 * Up to 3 parameters per event can be indexed.
 *
 * Usage: `Transfer: SkittlesEvent<{ from: Indexed<address>; to: Indexed<address>; value: number }>;`
 */
export type Indexed<T> = T;

/**
 * Wrapper type to mark an interface method return type as `view`.
 * View methods only read state and do not modify it. When called via
 * ethers.js, view functions return the value directly instead of a
 * transaction response.
 *
 * Usage:
 * ```typescript
 * interface IToken {
 *   balanceOf(account: address): View<number>;
 *   transfer(to: address, amount: number): boolean;
 * }
 * ```
 */
export type View<T> = T;

// Compiler API (parser + codegen)
export { generateSolidity, generateSolidityFile, generateSolidityForContracts } from "./compiler/codegen.ts";
export {
  collectClassNames,
  collectFunctions,
  collectTypes,
  parse,
} from "./compiler/parser.ts";
export { compileToSolidity } from "./compiler/pipeline.ts";
export type { CompilePipelineResult } from "./compiler/pipeline.ts";

// Utility functions
export { getErrorMessage } from "./utils/error.ts";

// Contract IR types (for advanced users / plugins)
export type {
  BuildArtifact,
  CollectedFunctions,
  CollectedTypes,
  SkittlesContract,
  SkittlesEvent as SkittlesEventDef,
  SkittlesFunction,
  SkittlesType,
  SkittlesTypeKind,
  SkittlesVariable,
  SourceMapping,
} from "./types/index.ts";

// Global objects for use in contract files.
// These provide type information for IDE support.
// At runtime they are unused; contract files are compiled, not executed.

export const msg = {} as {
  readonly sender: string;
  readonly value: number;
  readonly data: string;
};

export const block = {} as {
  readonly timestamp: number;
  readonly number: number;
  readonly chainid: number;
};

export const tx = {} as {
  readonly origin: string;
  readonly gasprice: number;
};

export declare const self: string;

// Solidity built-in functions (stubs for TypeScript type checking)
export declare function keccak256(...args: unknown[]): bytes32;
export declare function sha256(...args: unknown[]): bytes32;
export declare function hash(...args: unknown[]): bytes32;
export declare function ecrecover(
  hash: bytes32,
  v: number,
  r: bytes32,
  s: bytes32
): address;
export declare function addmod(x: number, y: number, k: number): number;
export declare function mulmod(x: number, y: number, k: number): number;

// abi namespace for encoding/decoding
export const abi = {} as {
  encode(...args: unknown[]): string;
  encodePacked(...args: unknown[]): string;
  decode<T extends unknown[] = unknown[]>(data: string): T;
};

// gasleft() function
export declare function gasleft(): number;

/**
 * Reference an external contract at a given address via its interface.
 * Compiles to `InterfaceName(address)` in Solidity.
 *
 * Usage:
 * ```typescript
 * const token: IToken = Contract<IToken>(tokenAddress);
 * token.transfer(to, amount);
 * ```
 */
export declare function Contract<T>(address: string): T;

// Augment Array with Skittles-specific methods for IDE support
declare global {
  interface Array<T> {
    /**
     * Remove the first occurrence of a value from the array using swap-and-pop.
     * Returns true if the value was found and removed, false otherwise.
     * Note: does not preserve array order.
     */
    remove(value: T): boolean;
  }
}
