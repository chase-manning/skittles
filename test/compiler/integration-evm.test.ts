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

describe("integration: EVM globals", () => {
  it("should compile msg.sender usage", () => {
    const { errors, solidity } = compileTS(`
      class Ownable {
        public owner: address;
        constructor() {
          this.owner = msg.sender;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("owner = msg.sender;");
  });

  it("should compile all block globals", () => {
    const { errors, solidity } = compileTS(`
      class BlockInfo {
        public lastCoinbase: address;
        public lastPrevrandao: number = 0;
        public lastGaslimit: number = 0;
        public lastBasefee: number = 0;
        public lastNumber: number = 0;
        public lastTimestamp: number = 0;
        public lastChainid: number = 0;

        public recordAll(): void {
          this.lastCoinbase = block.coinbase;
          this.lastPrevrandao = block.prevrandao;
          this.lastGaslimit = block.gaslimit;
          this.lastBasefee = block.basefee;
          this.lastNumber = block.number;
          this.lastTimestamp = block.timestamp;
          this.lastChainid = block.chainid;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("lastCoinbase = block.coinbase;");
    expect(solidity).toContain("lastPrevrandao = block.prevrandao;");
    expect(solidity).toContain("lastGaslimit = block.gaslimit;");
    expect(solidity).toContain("lastBasefee = block.basefee;");
    expect(solidity).toContain("lastNumber = block.number;");
    expect(solidity).toContain("lastTimestamp = block.timestamp;");
    expect(solidity).toContain("lastChainid = block.chainid;");
  });

  it("should compile all msg globals", () => {
    const { errors, solidity } = compileTS(`
      class MsgInfo {
        public lastSender: address;
        public lastValue: number = 0;

        public record(): void {
          this.lastSender = msg.sender;
          this.lastValue = msg.value;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("lastSender = msg.sender;");
    expect(solidity).toContain("lastValue = msg.value;");
  });

  it("should compile all tx globals", () => {
    const { errors, solidity } = compileTS(`
      class TxInfo {
        public lastOrigin: address;
        public lastGasprice: number = 0;

        public record(): void {
          this.lastOrigin = tx.origin;
          this.lastGasprice = tx.gasprice;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("lastOrigin = tx.origin;");
    expect(solidity).toContain("lastGasprice = tx.gasprice;");
  });

  it("should compile msg.value, block.timestamp, tx.origin", () => {
    const { errors, solidity } = compileTS(`
      class Globals {
        public lastDeposit: number = 0;
        public lastTime: number = 0;
        public lastOrigin: address;

        public deposit(): void {
          this.lastDeposit = msg.value;
          this.lastTime = block.timestamp;
          this.lastOrigin = tx.origin;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("lastDeposit = msg.value;");
    expect(solidity).toContain("lastTime = block.timestamp;");
    expect(solidity).toContain("lastOrigin = tx.origin;");
  });
});

describe("integration: EVM globals mutability inference", () => {
  it("should infer view for msg.sender access", () => {
    const source = `
      class Example {
        public getSender(): address {
          return msg.sender;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
    const { solidity } = compileTS(source);
    expect(solidity).toContain(
      "function getSender() public view virtual returns (address)"
    );
  });

  it("should infer view for block.timestamp access", () => {
    const source = `
      class Example {
        public getTimestamp(): number {
          return block.timestamp;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
    const { solidity } = compileTS(source);
    expect(solidity).toContain(
      "function getTimestamp() public view virtual returns (uint256)"
    );
  });

  it("should infer view for block.number access", () => {
    const source = `
      class Example {
        public getBlockNumber(): number {
          return block.number;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });

  it("should infer view for tx.origin access", () => {
    const source = `
      class Example {
        public getOrigin(): address {
          return tx.origin;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });

  it("should infer view for self access", () => {
    const source = `
      class Example {
        public getAddress(): address {
          return self;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });

  it("should infer view for gasleft() call", () => {
    const source = `
      class Example {
        public getGas(): number {
          return gasleft();
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });

  it("should still infer payable for msg.value access", () => {
    const source = `
      class Example {
        private total: number = 0;
        public deposit(): void {
          this.total += msg.value;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("payable");
  });

  it("should infer nonpayable when writing state with EVM globals", () => {
    const source = `
      class Example {
        private lastSender: address = msg.sender;
        public updateSender(): void {
          this.lastSender = msg.sender;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("nonpayable");
  });
});

describe("integration: cross-function mutability propagation", () => {
  it("should propagate nonpayable through internal call chains", () => {
    const source = `
      class Token {
        private balances: Record<address, number> = {};

        private _transfer(from: address, to: address, amount: number): void {
          this.balances[from] -= amount;
          this.balances[to] += amount;
        }

        public transfer(to: address, amount: number): void {
          this._transfer(msg.sender, to, amount);
        }
      }
    `;

    const contracts = parse(source, "test.ts");
    const token = contracts[0];

    const _transfer = token.functions.find((f) => f.name === "_transfer");
    const transfer = token.functions.find((f) => f.name === "transfer");
    expect(_transfer!.stateMutability).toBe("nonpayable");
    expect(transfer!.stateMutability).toBe("nonpayable");

    const { errors, solidity } = compileTS(source);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "function _transfer(address from, address to, uint256 amount) internal virtual {"
    );
    expect(solidity).toContain(
      "function transfer(address to, uint256 amount) public virtual {"
    );
    expect(solidity).not.toContain("view");
  });

  it("should propagate view through internal call chains", () => {
    const contracts = parse(
      `
      class Token {
        private balances: Record<address, number> = {};

        private _getBalance(account: address): number {
          return this.balances[account];
        }

        public balanceOf(account: address): number {
          return this._getBalance(account);
        }
      }
    `,
      "test.ts"
    );

    const token = contracts[0];
    const _getBalance = token.functions.find((f) => f.name === "_getBalance");
    const balanceOf = token.functions.find((f) => f.name === "balanceOf");
    expect(_getBalance!.stateMutability).toBe("view");
    expect(balanceOf!.stateMutability).toBe("view");
  });

  it("should handle deep call chains (A -> B -> C where C mutates state)", () => {
    const source = `
      class Deep {
        public value: number = 0;

        private _set(val: number): void {
          this.value = val;
        }

        private _middle(val: number): void {
          this._set(val);
        }

        public doSet(val: number): void {
          this._middle(val);
        }
      }
    `;

    const contracts = parse(source, "test.ts");
    const c = contracts[0];
    expect(c.functions.find((f) => f.name === "_set")!.stateMutability).toBe(
      "nonpayable"
    );
    expect(c.functions.find((f) => f.name === "_middle")!.stateMutability).toBe(
      "nonpayable"
    );
    expect(c.functions.find((f) => f.name === "doSet")!.stateMutability).toBe(
      "nonpayable"
    );

    const { errors } = compileTS(source);
    expect(errors).toHaveLength(0);
  });

  it("should propagate pure through internal call chains", () => {
    const source = `
      class MathHelper {
        private _double(x: number): number {
          return x * 2;
        }

        public doubleViaInternal(x: number): number {
          return this._double(x);
        }
      }
    `;

    const contracts = parse(source, "test.ts");
    const c = contracts[0];
    const _double = c.functions.find((f) => f.name === "_double");
    const doubleViaInternal = c.functions.find(
      (f) => f.name === "doubleViaInternal"
    );
    expect(_double!.stateMutability).toBe("pure");
    expect(doubleViaInternal!.stateMutability).toBe("pure");

    const { errors, solidity } = compileTS(source);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("pure");
    expect(solidity).not.toContain("view");
  });
});

