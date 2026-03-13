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

describe("integration: bitwise operators", () => {
  it("should compile bitwise AND, OR, XOR, shifts", () => {
    const { errors, solidity } = compileTS(`
      class BitOps {
        public bitwiseAnd(a: number, b: number): number {
          return a & b;
        }
        public bitwiseOr(a: number, b: number): number {
          return a | b;
        }
        public bitwiseXor(a: number, b: number): number {
          return a ^ b;
        }
        public leftShift(a: number, b: number): number {
          return a << b;
        }
        public rightShift(a: number, b: number): number {
          return a >> b;
        }
        public bitwiseNot(a: number): number {
          return ~a;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("(a & b)");
    expect(solidity).toContain("(a | b)");
    expect(solidity).toContain("(a ^ b)");
    expect(solidity).toContain("(a << b)");
    expect(solidity).toContain("(a >> b)");
    expect(solidity).toContain("~a");
  });

  it("should compile bitwise assignment operators", () => {
    const { errors, solidity } = compileTS(`
      class BitAssign {
        public x: number = 0;
        public ops(): void {
          this.x &= 0xFF;
          this.x |= 0x01;
          this.x ^= 0x10;
          this.x <<= 2;
          this.x >>= 1;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("x &= 255");
    expect(solidity).toContain("x |= 1");
    expect(solidity).toContain("x ^= 16");
    expect(solidity).toContain("x <<= 2");
    expect(solidity).toContain("x >>= 1");
  });
});

// ============================================================
// break, continue, do-while
// ============================================================

describe("integration: void operator", () => {
  it("should handle void operator by keeping the expression", () => {
    const contracts = parse(
      `
      class Test {
        public value: number = 0;
        public doSomething(): void {
          void (this.value = 5);
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("value = 5;");
  });
});

// ============================================================
// Comma operator
// ============================================================

describe("integration: comma operator", () => {
  it("should handle comma operator by using the last value", () => {
    const contracts = parse(
      `
      class Test {
        public getVal(): number {
          return (1, 2, 3);
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("return 3;");
  });
});

// ============================================================
// Getter/setter accessors
// ============================================================

describe("integration: delete expressions", () => {
  it("should compile delete on mapping entry", () => {
    const { errors, solidity } = compileTS(`
      class Registry {
        private data: Record<address, number> = {};

        public remove(addr: address): void {
          delete this.data[addr];
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("delete data[addr];");
  });

  it("should detect delete as state mutation", () => {
    const contracts = parse(
      `
      class Registry {
        private data: Record<address, number> = {};

        public remove(addr: address): void {
          delete this.data[addr];
        }
      }
    `,
      "test.ts"
    );
    expect(contracts[0].functions[0].stateMutability).toBe("nonpayable");
  });
});

// ============================================================
// Map method support
// ============================================================

describe("integration: spread operator", () => {
  it("should compile [...a, ...b] with memory array parameters", () => {
    const { solidity, errors } = compileTS(`
      class SpreadTest {
        public combineArrays(a: number[], b: number[]): number[] {
          return [...a, ...b];
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_arrSpread_uint256");
    expect(solidity).toContain(
      "function _arrSpread_uint256(uint256[] memory a, uint256[] memory b)"
    );
  });

  it("should compile [...a, ...b] with address arrays", () => {
    const { solidity, errors } = compileTS(`
      import { address } from "skittles";
      class AddrSpread {
        public merge(a: address[], b: address[]): address[] {
          return [...a, ...b];
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_arrSpread_address");
  });

  it("should compile [...a, ...b, ...c] with three arrays", () => {
    const { solidity, errors } = compileTS(`
      class ThreeSpread {
        public mergeThree(a: number[], b: number[], c: number[]): number[] {
          return [...a, ...b, ...c];
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_arrSpread_uint256");
  });

  it("should compile spread of storage arrays with automatic slice conversion", () => {
    const { solidity, errors } = compileTS(`
      class StorageSpread {
        private items1: number[] = [];
        private items2: number[] = [];

        public combined(): number[] {
          return [...this.items1, ...this.items2];
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_arrSpread_uint256");
    expect(solidity).toContain("_arrSlice_uint256");
  });

  it("should throw error for mixed spread and non-spread elements", () => {
    expect(() =>
      compileTS(`
        class MixedSpread {
          public bad(a: number[]): number[] {
            return [...a, 42];
          }
        }
      `)
    ).toThrow(
      "Array spread does not support mixing spread and non-spread elements"
    );
  });
});

// ============================================================
// Array sort
// ============================================================

describe("integration: nullish coalescing and optional chaining", () => {
  it("should compile ?? to ternary with zero check", () => {
    const { errors, solidity } = compileTS(`
      class Fallback {
        balances: Map<address, number> = new Map();
        public getBalanceOrDefault(account: address): number {
          return this.balances[account] ?? 0;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "(balances[account] == 0) ? 0 : balances[account]"
    );
  });

  it("should compile ?? with address type using address(0)", () => {
    const { errors, solidity } = compileTS(`
      class AddressFallback {
        owners: Map<number, address> = new Map();
        public getOwnerOrDefault(id: number, defaultAddr: address): address {
          return this.owners[id] ?? defaultAddr;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "(owners[id] == address(0)) ? defaultAddr : owners[id]"
    );
  });

  it("should compile optional chaining (?.) as regular property access", () => {
    const { errors, solidity } = compileTS(`
      class OptChain {
        public getData(): address {
          return msg?.sender;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("msg.sender");
  });
});

