export type address = string;
export type bytes = string;

export class block {
  // Current block miner’s address
  static get coinbase(): address {
    return "0x0000000000000000000000000000000000000000";
  }

  // Current block difficulty
  static get difficulty(): number {
    return 0;
  }

  // Current block number
  static get block(): number {
    return 0;
  }

  // Equivalent to blockhash(block.number - 1)
  static get prevhash(): number {
    return 0;
  }

  // Current block epoch timestamp
  static get timestamp(): number {
    return 0;
  }
}

export class chain {
  // Chain ID
  static get id(): number {
    return 0;
  }
}

export class msg {
  // Message data
  static get data(): string {
    return "";
  }

  // Sender of the message (current call)
  static get sender(): address {
    return "0x0000000000000000000000000000000000000000";
  }

  // Number of wei sent with the message
  static get value(): number {
    return 0;
  }
}

export class tx {
  // Gas price of current transaction in wei
  static get gasPrice(): number {
    return 0;
  }

  // Sender of the transaction (full call chain)
  static get origin(): address {
    return "0x0000000000000000000000000000000000000000";
  }
}

export interface SkittlesEvent<Type> {
  emit(data: Type): void;
}

export interface SkittlesConfig {
  // Optional: Optimizer settings
  optimizer?: {
    // Disabled by default.
    // NOTE: enabled=false still leaves some optimizations on. See comments below.
    // WARNING: Before version 0.8.6 omitting the 'enabled' key was not equivalent to setting
    // it to false and would actually disable all the optimizations.
    enabled?: boolean;
    // Optimize for how many times you intend to run the code.
    // Lower values will optimize more for initial deployment cost, higher
    // values will optimize more for high-frequency usage.
    runs?: number;
    // Switch optimizer components on or off in detail.
    // The "enabled" switch above provides two defaults which can be
    // tweaked here. If "details" is given, "enabled" can be omitted.
    details?: {
      // The peephole optimizer is always on if no details are given,
      // use details to switch it off.
      peephole?: boolean;
      // The inliner is always on if no details are given,
      // use details to switch it off.
      inliner?: boolean;
      // The unused jumpdest remover is always on if no details are given,
      // use details to switch it off.
      jumpdestRemover?: boolean;
      // Sometimes re-orders literals in commutative operations.
      orderLiterals?: boolean;
      // Removes duplicate code blocks
      deduplicate?: boolean;
      // Common subexpression elimination, this is the most complicated step but
      // can also provide the largest gain.
      cse?: boolean;
      // Optimize representation of literal numbers and strings in code.
      constantOptimizer?: boolean;
      // The new Yul optimizer. Mostly operates on the code of ABI coder v2
      // and inline assembly.
      // It is activated together with the global optimizer setting
      // and can be deactivated here.
      // Before Solidity 0.6.0 it had to be activated through this switch.
      yul?: boolean;
      // Tuning options for the Yul optimizer.
      yulDetails?: {
        // Improve allocation of stack slots for variables, can free up stack slots early.
        // Activated by default if the Yul optimizer is activated.
        stackAllocation?: boolean;
        // Select optimization steps to be applied.
        // Optional, the optimizer will use the default sequence if omitted.
        optimizerSteps?: string;
      };
    };
  };
}

export const hash = (...args: (number | address | boolean | bytes)[]): bytes => {
  return "123";
};

export class SkittlesContract {
  // Address of the contract
  address: address = "0x0000000000000000000000000000000000000000";

  // // balance of the Address in Wei
  // balance: number = 0;

  // // code at the Contract (can be empty)
  // code: bytes = "";

  // // code at the Contract (can be empty)
  // codehash: bytes = "";

  // // send given amount of Wei to Address, reverts on failure, forwards 2300 gas stipend, not adjustable
  // transfer(value: number): void {}

  // // send given amount of Wei to Address, returns false on failure, forwards 2300 gas stipend, not adjustable
  // send(value: number): boolean {
  //   return Math.random() > 0.5;
  // }

  // // issue low-level CALL with the given payload, returns success condition and return data, forwards all available gas, adjustable
  // call(bytes: bytes): { bool: boolean; bytes: bytes } {
  //   return {
  //     bool: Math.random() > 0.5,
  //     bytes: "123",
  //   };
  // }

  // // issue low-level DELEGATECALL with the given payload, returns success condition and return data, forwards all available gas, adjustable
  // delegatecall(bytes: bytes): { bool: boolean; bytes: bytes } {
  //   return {
  //     bool: Math.random() > 0.5,
  //     bytes: "123",
  //   };
  // }

  // // issue low-level STATICCALL with the given payload, returns success condition and return data, forwards all available gas, adjustable
  // staticcall(bytes: bytes): { bool: boolean; bytes: bytes } {
  //   return {
  //     bool: Math.random() > 0.5,
  //     bytes: "123",
  //   };
  // }
}

export class Account extends SkittlesContract {
  constructor(address: address) {
    super();
  }
}
