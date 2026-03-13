// ============================================================
// Named constants for magic numbers and strings used across
// the compiler.  Centralising these values makes intent clear
// and avoids scattered magic literals.
// ============================================================

// -- ASCII character codes (used in Solidity string helpers) --

/** ASCII code for uppercase 'A' (65) */
export const CHAR_A = 65;
/** ASCII code for uppercase 'Z' (90) */
export const CHAR_Z = 90;
/** ASCII code for lowercase 'a' (97) */
export const CHAR_a = 97;
/** ASCII code for lowercase 'z' (122) */
export const CHAR_z = 122;
/** ASCII code for space ' ' (32) */
export const CHAR_SPACE = 32;
/** ASCII code for digit '0' (48) */
export const CHAR_0 = 48;

// -- Error messages --

/** Error string emitted by the array splice helper when the start index
 *  exceeds the array length. */
export const ERR_START_OUT_OF_BOUNDS = "start out of bounds";

// -- Solc integration --

/** Virtual filename used when compiling multiple contracts in a single
 *  solc invocation (batch compilation). */
export const BATCH_SOURCE_FILENAME = "Contracts.sol";

// -- Incremental compilation cache --

/**
 * Bump this version whenever the on-disk cache format changes so that
 * stale caches are automatically invalidated.  History:
 *   "5" – current format.
 */
export const CACHE_VERSION = "5";

/**
 * Number of hex characters to keep from the SHA-256 digest when hashing
 * cache keys.  16 hex chars = 64 bits – enough to avoid collisions in
 * practice while keeping keys short.
 */
export const CACHE_HASH_LENGTH = 16;
