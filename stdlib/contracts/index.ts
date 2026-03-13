/**
 * Skittles standard library contracts.
 *
 * TypeScript implementations of popular OpenZeppelin contracts that compile
 * directly to Solidity. Import any contract and extend it in your own code:
 *
 * ```typescript
 * import { ERC20, Ownable } from "skittles/contracts";
 *
 * export class MyToken extends ERC20 {
 *   constructor() {
 *     super("MyToken", "MTK");
 *   }
 * }
 * ```
 */

// Constants
export { ZERO_ADDRESS } from "./constants.ts";

// Token standards
export { ERC20 } from "./token/ERC20.ts";
export { ERC20Permit } from "./token/ERC20Permit.ts";
export { ERC20Votes } from "./token/ERC20Votes.ts";
export { ERC721 } from "./token/ERC721.ts";

// Access control
export { Ownable } from "./access/Ownable.ts";
export { AccessControl } from "./access/AccessControl.ts";

// Security
export { Pausable } from "./security/Pausable.ts";
export { ReentrancyGuard } from "./security/ReentrancyGuard.ts";
