/**
 * Public API exports for the skittles package.
 * Users import from "skittles" in their contract files and config.
 */

// Config type (for skittles.config.json / skittles.config.js)
export type { SkittlesConfig } from "./types";

// Ethereum primitive types (for contract files)
export type { address, bytes } from "./types";

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

// Contract IR types (for advanced users / plugins)
export type {
  SkittlesContract,
  SkittlesVariable,
  SkittlesFunction,
  SkittlesEvent as SkittlesEventDef,
  SkittlesType,
  SkittlesTypeKind,
  BuildArtifact,
} from "./types";

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
