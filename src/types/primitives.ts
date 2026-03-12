// ============================================================
// Shared constants
// ============================================================

/** Matches a 20-byte hex address literal: "0x" followed by exactly 40 hex digits. */
export const ADDRESS_LITERAL_RE = /^0x[0-9a-fA-F]{40}$/;

// ============================================================
// User contract types (exported for contract authors)
// ============================================================

export type address = string;
export type bytes = string;
export type bytes32 = string;
