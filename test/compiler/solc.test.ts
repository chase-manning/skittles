import { describe, it, expect } from "vitest";
import { compileSolidity } from "../../src/compiler/solc";
import type { SkittlesConfig } from "../../src/types";
import { defaultConfig } from "../fixtures";

describe("compileSolidity", () => {
  it("should compile a simple Solidity contract", () => {
    const source = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 private value;

    function get() public view returns (uint256) {
        return value;
    }

    function set(uint256 newValue) public {
        value = newValue;
    }
}
`;

    const result = compileSolidity("SimpleStorage", source, defaultConfig);

    expect(result.errors).toHaveLength(0);
    expect(result.abi).toBeDefined();
    expect(result.abi.length).toBeGreaterThan(0);
    expect(result.bytecode).toBeDefined();
    expect(result.bytecode.length).toBeGreaterThan(0);
  });

  it("should return errors for invalid Solidity", () => {
    const source = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Broken {
    this is not valid solidity
}
`;

    const result = compileSolidity("Broken", source, defaultConfig);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should compile with optimizer enabled", () => {
    const optimizedConfig: Required<SkittlesConfig> = {
      ...defaultConfig,
      optimizer: { enabled: true, runs: 200 },
    };

    const source = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Optimized {
    uint256 public value;

    function set(uint256 v) public {
        value = v;
    }
}
`;

    const result = compileSolidity("Optimized", source, optimizedConfig);
    expect(result.errors).toHaveLength(0);
    expect(result.bytecode.length).toBeGreaterThan(0);
  });
});
