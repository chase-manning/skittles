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

describe("integration: events", () => {
  it("should compile events with emit", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        Transfer: SkittlesEvent<{ from: address; to: address; amount: number }>;

        public totalSupply: number = 0;
        private balances: Record<address, number> = {};

        public transfer(to: address, amount: number): boolean {
          this.balances[msg.sender] -= amount;
          this.balances[to] += amount;
          this.Transfer.emit({ from: msg.sender, to, amount });
          return true;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "event Transfer(address from, address to, uint256 amount);"
    );
    expect(solidity).toContain("emit Transfer(msg.sender, to, amount);");
  });

  it("should compile multiple events", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        Transfer: SkittlesEvent<{ from: address; to: address; amount: number }>;
        Approval: SkittlesEvent<{ owner: address; spender: address; amount: number }>;

        public totalSupply: number = 0;

        public approve(spender: address, amount: number): void {
          this.Approval.emit(msg.sender, spender, amount);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("event Transfer(");
    expect(solidity).toContain("event Approval(");
    expect(solidity).toContain("emit Approval(msg.sender, spender, amount);");
  });
});

describe("integration: indexed event parameters", () => {
  it("should compile events with indexed parameters", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        Transfer: SkittlesEvent<{ from: Indexed<address>; to: Indexed<address>; value: number }> = {} as any;

        public transfer(to: address, amount: number): void {
          this.Transfer.emit(msg.sender, to, amount);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "event Transfer(address indexed from, address indexed to, uint256 value);"
    );
  });

  it("should compile events without indexed parameters unchanged", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        Log: SkittlesEvent<{ message: string; value: number }> = {} as any;

        public logIt(): void {
          this.Log.emit("hello", 42);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("event Log(string message, uint256 value);");
    expect(solidity).not.toContain("indexed");
  });
});

// ============================================================
// Constant state variables
// ============================================================

