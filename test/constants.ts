export { ZERO_ADDRESS } from "../stdlib/contracts/constants.ts";
export const MAX_UINT256 = (1n << 256n) - 1n;
export const INITIAL_SUPPLY = 1_000_000n;
export const BEHAVIORAL_TIMEOUT = 30_000;
export const BEHAVIORAL_TIMEOUT_LONG = 60_000;

// keccak256("MINTER_ROLE")
export const MINTER_ROLE =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
export const DEFAULT_ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
