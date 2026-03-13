import { describe, expect,it } from "vitest";

import {
  generateSolidity,
} from "../../src/compiler/codegen";
import {
  parse,
} from "../../src/compiler/parser";
import { compileSolidity } from "../../src/compiler/solc";
import { defaultConfig } from "../fixtures";

function compileTS(source: string): {
  solidity: string;
  abi: unknown[];
  bytecode: string;
  errors: string[];
} {
  const contracts = parse(source, "test.ts");
  expect(contracts.length).toBeGreaterThan(0);

  const contract = contracts[0];
  const solidity = generateSolidity(contract);
  const result = compileSolidity(contract.name, solidity, defaultConfig);

  return {
    solidity,
    abi: result.abi,
    bytecode: result.bytecode,
    errors: result.errors,
  };
}

// ============================================================
// End to end: TypeScript -> Solidity -> solc -> bytecode
// ============================================================

describe("integration: custom errors", () => {
  it("should compile custom error classes", () => {
    const { errors, solidity } = compileTS(`
      class InsufficientBalance extends Error {
        constructor(available: number, required: number) {
          super("");
        }
      }

      class Token {
        private balances: Record<address, number> = {};

        public withdraw(amount: number): void {
          if (this.balances[msg.sender] < amount) {
            throw new InsufficientBalance(this.balances[msg.sender], amount);
          }
          this.balances[msg.sender] -= amount;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "error InsufficientBalance(uint256 available, uint256 required);"
    );
    expect(solidity).toContain(
      "revert InsufficientBalance(balances[msg.sender], amount);"
    );
    expect(solidity).not.toContain("require(");
  });

  it("should still compile regular Error as revert/require", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        public check(x: number): void {
          if (x == 0) {
            throw new Error("zero");
          }
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain('require((x != 0), "zero");');
  });
});

// ============================================================
// Inline custom errors (SkittlesError<{...}>)
// ============================================================

describe("integration: inline SkittlesError declarations", () => {
  it("should compile SkittlesError properties as custom error declarations", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        InsufficientBalance: SkittlesError<{ sender: address; balance: number; required: number }>;
        private balances: Record<address, number> = {};

        public withdraw(amount: number): void {
          if (this.balances[msg.sender] < amount) {
            throw this.InsufficientBalance(msg.sender, this.balances[msg.sender], amount);
          }
          this.balances[msg.sender] -= amount;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "error InsufficientBalance(address sender, uint256 balance, uint256 required);"
    );
    expect(solidity).toContain(
      "revert InsufficientBalance(msg.sender, balances[msg.sender], amount);"
    );
    expect(solidity).not.toContain("require(");
  });

  it("should compile SkittlesError with no parameters", () => {
    const { errors, solidity } = compileTS(`
      class Vault {
        VaultPaused: SkittlesError<{}>;
        public status: number = 0;

        public deposit(): void {
          if (this.status == 1) {
            throw this.VaultPaused();
          }
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("error VaultPaused();");
    expect(solidity).toContain("revert VaultPaused();");
  });

  it("should not include SkittlesError properties as state variables", () => {
    const contracts = parse(
      `
      class Token {
        NotOwner: SkittlesError<{ caller: address }>;
        public value: number = 0;
      }
    `,
      "test.ts"
    );
    expect(contracts[0].variables).toHaveLength(1);
    expect(contracts[0].variables[0].name).toBe("value");
    expect(contracts[0].customErrors).toHaveLength(1);
    expect(contracts[0].customErrors[0].name).toBe("NotOwner");
  });

  it("should support both old class style and new inline style in same file", () => {
    const { errors, solidity } = compileTS(`
      class OldError extends Error {
        constructor(x: number) {
          super("");
        }
      }

      class Token {
        NewError: SkittlesError<{ y: number }>;
        public value: number = 0;

        public testOld(): void {
          throw new OldError(1);
        }

        public testNew(): void {
          throw this.NewError(2);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("error OldError(uint256 x);");
    expect(solidity).toContain("error NewError(uint256 y);");
    expect(solidity).toContain("revert OldError(1);");
    expect(solidity).toContain("revert NewError(2);");
  });

  it("should infer view mutability when custom error args reference msg.sender", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        InsufficientBalance: SkittlesError<{ sender: address; balance: number; required: number }>;

        public testCustomError(): void {
          throw this.InsufficientBalance(msg.sender, 0, 100);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "function testCustomError() public view virtual"
    );
    expect(solidity).not.toContain("pure");
  });
});

// ============================================================
// Arrow function class properties
// ============================================================

