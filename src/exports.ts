/**
 * Public API exports for the skittles package.
 * Users import from "skittles" in their contract files and config.
 */

// Config type (for skittles.config.json / skittles.config.js)
export type { SkittlesConfig } from "./types/index.ts";

// Ethereum primitive types (for contract files)
export type { address, bytes } from "./types/index.ts";

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

// Contract IR types (for advanced users / plugins)
export type {
  SkittlesContract,
  SkittlesVariable,
  SkittlesFunction,
  SkittlesEvent as SkittlesEventDef,
  SkittlesType,
  SkittlesTypeKind,
  BuildArtifact,
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

// Solidity built-in functions (stubs for TypeScript type checking)
export declare function keccak256(...args: unknown[]): string;
export declare function sha256(...args: unknown[]): string;
export declare function ecrecover(hash: string, v: number, r: string, s: string): string;
export declare function addmod(x: number, y: number, k: number): number;
export declare function mulmod(x: number, y: number, k: number): number;

// abi namespace for encoding/decoding
export const abi = {} as {
  encode(...args: unknown[]): string;
  encodePacked(...args: unknown[]): string;
  decode(data: string, ...types: unknown[]): unknown;
};

// gasleft() function
export declare function gasleft(): number;
