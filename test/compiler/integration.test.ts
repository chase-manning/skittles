import { describe, it, expect } from "vitest";
import { parse, collectTypes, collectFunctions } from "../../src/compiler/parser";
import { generateSolidity, generateSolidityFile } from "../../src/compiler/codegen";
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

  return { solidity, abi: result.abi, bytecode: result.bytecode, errors: result.errors };
}

// ============================================================
// End to end: TypeScript -> Solidity -> solc -> bytecode
// ============================================================

describe("integration: empty contract", () => {
  it("should compile an empty contract", () => {
    const { solidity, errors, bytecode } = compileTS(
      "export class Empty {}"
    );
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("contract Empty {");
    expect(bytecode.length).toBeGreaterThan(0);
  });
});

describe("integration: state variables", () => {
  it("should compile a contract with primitive state variables", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        public name: string = "MyToken";
        public totalSupply: number = 0;
        public active: boolean = true;
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain('string public name = "MyToken"');
    expect(solidity).toContain("uint256 public totalSupply = 0");
    expect(solidity).toContain("bool public active = true");
  });

  it("should compile a contract with mapping state variable", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        private balances: Record<address, number> = {};
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("mapping(address => uint256) internal balances");
  });

  it("should compile a contract with nested mapping", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        private allowances: Record<address, Record<address, number>> = {};
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "mapping(address => mapping(address => uint256)) internal allowances"
    );
  });
});

describe("integration: constructor", () => {
  it("should compile a constructor with parameters", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        public totalSupply: number = 0;
        constructor(supply: number) {
          this.totalSupply = supply;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("constructor(uint256 supply)");
    expect(solidity).toContain("totalSupply = supply;");
  });
});

describe("integration: functions", () => {
  it("should compile a pure function", () => {
    const { errors, solidity } = compileTS(`
      class Math {
        public add(a: number, b: number): number {
          return a + b;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "function add(uint256 a, uint256 b) public pure virtual returns (uint256)"
    );
  });

  it("should compile a view function", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        public totalSupply: number = 0;
        public getSupply(): number {
          return this.totalSupply;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function getSupply() public view virtual returns (uint256)");
  });

  it("should compile a state-mutating function", () => {
    const { errors, solidity } = compileTS(`
      class Counter {
        public count: number = 0;
        public increment(): void {
          this.count = this.count + 1;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function increment() public virtual {");
    expect(solidity).toContain("count = (count + 1);");
  });

  it("should compile function with string parameter using memory", () => {
    const { errors, solidity } = compileTS(`
      class Greeter {
        public greeting: string = "hello";
        public setGreeting(newGreeting: string): void {
          this.greeting = newGreeting;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("string memory newGreeting");
  });
});

describe("integration: control flow", () => {
  it("should compile if/throw as require", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        public value: number = 0;
        public withdraw(amount: number): void {
          if (this.value < amount) {
            throw new Error("Insufficient");
          }
          this.value = this.value - amount;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain('require((value >= amount), "Insufficient")');
  });

  it("should compile for loops", () => {
    const { errors, solidity } = compileTS(`
      class Sum {
        public total: number = 0;
        public sumTo(n: number): void {
          for (let i: number = 0; i < n; i++) {
            this.total = this.total + i;
          }
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("for (uint256 i = 0;");
  });

  it("should compile if/else", () => {
    const { errors, solidity } = compileTS(`
      class Logic {
        public pick(cond: boolean, a: number, b: number): number {
          if (cond) {
            return a;
          } else {
            return b;
          }
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("if (cond)");
    expect(solidity).toContain("} else {");
  });

  it("should compile else if chains", () => {
    const { errors, solidity } = compileTS(`
      class Branching {
        public classify(value: number): number {
          if (value % 2 == 0) {
            return 789;
          } else if (value * 7 == 21) {
            return 123;
          } else {
            return 43;
          }
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function classify(uint256 value) public pure virtual returns (uint256)");
    expect(solidity).toContain("(value % 2)");
    expect(solidity).toContain("} else {");
    expect(solidity).toContain("return 43;");
  });

  it("should compile logical operators (&&, ||, !)", () => {
    const { errors, solidity } = compileTS(`
      class Logic {
        public checkAnd(a: boolean): boolean {
          return a && true;
        }
        public checkOr(a: boolean): boolean {
          return a || false;
        }
        public checkNot(a: boolean): boolean {
          return !a;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("(a && true)");
    expect(solidity).toContain("(a || false)");
    expect(solidity).toContain("!a");
  });

  it("should compile modulo and power operators", () => {
    const { errors, solidity } = compileTS(`
      class MathOps {
        public modulo(a: number, b: number): number {
          return a % b;
        }
        public power(a: number, b: number): number {
          return a ** b;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("(a % b)");
    expect(solidity).toContain("(a ** b)");
  });
});

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
    expect(solidity).toContain("event Transfer(address from, address to, uint256 amount);");
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

describe("integration: arrays", () => {
  it("should compile array state variables", () => {
    const { errors, solidity } = compileTS(`
      class Registry {
        public addresses: address[] = [];

        public add(addr: address): void {
          this.addresses.push(addr);
        }

        public count(): number {
          return this.addresses.length;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("address[] public addresses;");
    expect(solidity).toContain("addresses.push(addr);");
    expect(solidity).toContain("return addresses.length;");
  });

  it("should detect array push as nonpayable", () => {
    const contracts = parse(`
      class R {
        public items: number[] = [];
        public addItem(val: number): void {
          this.items.push(val);
        }
      }
    `, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("nonpayable");
  });

  it("should detect array read as view", () => {
    const contracts = parse(`
      class R {
        public items: number[] = [];
        public getCount(): number {
          return this.items.length;
        }
      }
    `, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });
});

describe("integration: inheritance", () => {
  it("should compile contracts with inheritance in the same file", () => {
    const source = `
      class Ownable {
        public owner: address;

        constructor() {
          this.owner = msg.sender;
        }

        public getOwner(): address {
          return this.owner;
        }
      }

      class Token extends Ownable {
        public totalSupply: number = 0;

        public mint(amount: number): void {
          this.totalSupply = this.totalSupply + amount;
        }
      }
    `;

    const contracts = parse(source, "test.ts");
    expect(contracts).toHaveLength(2);
    expect(contracts[1].inherits).toEqual(["Ownable"]);

    const solidity = generateSolidityFile(contracts);
    expect(solidity).toContain("contract Ownable {");
    expect(solidity).toContain("contract Token is Ownable {");

    // Compile the combined Solidity (both contracts together)
    const result = compileSolidity("Token", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
    expect(result.bytecode.length).toBeGreaterThan(0);
  });
});

describe("integration: full token contract", () => {
  it("should compile a complete ERC20-like token", () => {
    const source = `
      class Token {
        public name: string = "MyToken";
        public symbol: string = "MTK";
        public totalSupply: number = 0;
        private balances: Record<address, number> = {};

        constructor(initialSupply: number) {
          this.totalSupply = initialSupply;
          this.balances[msg.sender] = initialSupply;
        }

        public balanceOf(account: address): number {
          return this.balances[account];
        }

        public transfer(to: address, amount: number): boolean {
          const sender: address = msg.sender;
          if (this.balances[sender] < amount) {
            throw new Error("Insufficient balance");
          }
          this.balances[sender] -= amount;
          this.balances[to] += amount;
          return true;
        }
      }
    `;

    const { errors, solidity, bytecode, abi } = compileTS(source);

    expect(errors).toHaveLength(0);
    expect(bytecode.length).toBeGreaterThan(0);

    // Verify Solidity structure
    expect(solidity).toContain("contract Token {");
    expect(solidity).toContain('string public name = "MyToken"');
    expect(solidity).toContain("mapping(address => uint256) internal balances");
    expect(solidity).toContain("constructor(uint256 initialSupply)");
    expect(solidity).toContain("function balanceOf(address account) public view virtual returns (uint256)");
    expect(solidity).toContain("function transfer(address to, uint256 amount) public virtual returns (bool)");
    expect(solidity).toContain('require((balances[sender] >= amount), "Insufficient balance")');
    expect(solidity).toContain("balances[sender] -= amount");
    expect(solidity).toContain("balances[to] += amount");

    // Verify ABI has the expected functions
    const fnNames = (abi as { name?: string }[])
      .filter((item) => item.name)
      .map((item) => item.name);
    expect(fnNames).toContain("balanceOf");
    expect(fnNames).toContain("transfer");
    expect(fnNames).toContain("name");
    expect(fnNames).toContain("symbol");
    expect(fnNames).toContain("totalSupply");
  });
});

describe("integration: additional features", () => {
  it("should compile while loops", () => {
    const { errors, solidity } = compileTS(`
      class WhileTest {
        public total: number = 0;
        public sumWhile(n: number): void {
          let i: number = 0;
          while (i < n) {
            this.total = this.total + i;
            i++;
          }
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("while ((i < n))");
  });

  it("should compile ternary expressions", () => {
    const { errors, solidity } = compileTS(`
      class Ternary {
        public max(a: number, b: number): number {
          return a > b ? a : b;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function max(uint256 a, uint256 b) public pure virtual returns (uint256)");
  });

  it("should compile Number.MAX_SAFE_INTEGER as 9007199254740991", () => {
    const { errors, solidity } = compileTS(`
      class SafeInt {
        public maxSafe: number = 0;
        public setMaxSafe(): void {
          this.maxSafe = Number.MAX_SAFE_INTEGER;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("9007199254740991");
  });

  it("should compile Number.MAX_VALUE as type(uint256).max", () => {
    const { errors, solidity } = compileTS(`
      class MaxValue {
        public maxUint: number = 0;
        public setMax(): void {
          this.maxUint = Number.MAX_VALUE;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("type(uint256).max");
  });

  it("should compile private methods as internal", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        public totalSupply: number = 0;
        private balances: Record<address, number> = {};

        private _transfer(from: address, to: address, amount: number): void {
          this.balances[from] -= amount;
          this.balances[to] += amount;
        }

        public transfer(to: address, amount: number): void {
          this._transfer(msg.sender, to, amount);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function _transfer(address from, address to, uint256 amount) internal virtual {");
    expect(solidity).toContain("function transfer(address to, uint256 amount) public virtual {");
    expect(solidity).toContain("_transfer(msg.sender, to, amount);");
  });

  it("should compile immutable value types with readonly", () => {
    const { errors, solidity } = compileTS(`
      class Config {
        public readonly maxSupply: number = 1000000;
        public readonly owner: address;

        constructor() {
          this.owner = msg.sender;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("uint256 public immutable maxSupply = 1000000;");
    expect(solidity).toContain("address public immutable owner;");
  });

  it("should not use immutable for string readonly vars", () => {
    const { errors, solidity } = compileTS(`
      class Named {
        public readonly name: string = "Test";
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain('string public name = "Test"');
    expect(solidity).not.toContain("immutable");
  });

  it("should handle Number.MAX_VALUE in conditionals", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        private allowances: Record<address, Record<address, number>> = {};
        private balances: Record<address, number> = {};

        public transferFrom(from: address, to: address, amount: number): boolean {
          if (this.allowances[from][msg.sender] !== Number.MAX_VALUE) {
            this.allowances[from][msg.sender] -= amount;
          }
          this.balances[from] -= amount;
          this.balances[to] += amount;
          return true;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("type(uint256).max");
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

    const _transfer = token.functions.find(f => f.name === "_transfer");
    const transfer = token.functions.find(f => f.name === "transfer");
    expect(_transfer!.stateMutability).toBe("nonpayable");
    expect(transfer!.stateMutability).toBe("nonpayable");

    const { errors, solidity } = compileTS(source);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function _transfer(address from, address to, uint256 amount) internal virtual {");
    expect(solidity).toContain("function transfer(address to, uint256 amount) public virtual {");
    expect(solidity).not.toContain("view");
  });

  it("should propagate view through internal call chains", () => {
    const contracts = parse(`
      class Token {
        private balances: Record<address, number> = {};

        private _getBalance(account: address): number {
          return this.balances[account];
        }

        public balanceOf(account: address): number {
          return this._getBalance(account);
        }
      }
    `, "test.ts");

    const token = contracts[0];
    const _getBalance = token.functions.find(f => f.name === "_getBalance");
    const balanceOf = token.functions.find(f => f.name === "balanceOf");
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
    expect(c.functions.find(f => f.name === "_set")!.stateMutability).toBe("nonpayable");
    expect(c.functions.find(f => f.name === "_middle")!.stateMutability).toBe("nonpayable");
    expect(c.functions.find(f => f.name === "doSet")!.stateMutability).toBe("nonpayable");

    const { errors } = compileTS(source);
    expect(errors).toHaveLength(0);
  });
});

describe("integration: full ERC20 with events and allowances", () => {
  it("should compile a feature complete ERC20 token", () => {
    const source = `
      class ERC20 {
        Transfer: SkittlesEvent<{ from: address; to: address; value: number }>;
        Approval: SkittlesEvent<{ owner: address; spender: address; value: number }>;

        public name: string = "MyToken";
        public symbol: string = "MTK";
        public decimals: number = 18;
        public totalSupply: number = 0;
        private balances: Record<address, number> = {};
        private allowances: Record<address, Record<address, number>> = {};

        constructor(initialSupply: number) {
          this.totalSupply = initialSupply;
          this.balances[msg.sender] = initialSupply;
        }

        public balanceOf(account: address): number {
          return this.balances[account];
        }

        public allowance(owner: address, spender: address): number {
          return this.allowances[owner][spender];
        }

        public transfer(to: address, amount: number): boolean {
          const sender: address = msg.sender;
          if (this.balances[sender] < amount) {
            throw new Error("ERC20: transfer amount exceeds balance");
          }
          this.balances[sender] -= amount;
          this.balances[to] += amount;
          this.Transfer.emit({ from: sender, to, value: amount });
          return true;
        }

        public approve(spender: address, amount: number): boolean {
          this.allowances[msg.sender][spender] = amount;
          this.Approval.emit({ owner: msg.sender, spender, value: amount });
          return true;
        }

        public transferFrom(from: address, to: address, amount: number): boolean {
          const spender: address = msg.sender;
          if (this.allowances[from][spender] < amount) {
            throw new Error("ERC20: insufficient allowance");
          }
          if (this.balances[from] < amount) {
            throw new Error("ERC20: transfer amount exceeds balance");
          }
          this.allowances[from][spender] -= amount;
          this.balances[from] -= amount;
          this.balances[to] += amount;
          this.Transfer.emit({ from, to, value: amount });
          return true;
        }
      }
    `;

    const { errors, solidity, bytecode, abi } = compileTS(source);

    expect(errors).toHaveLength(0);
    expect(bytecode.length).toBeGreaterThan(0);

    // Verify event declarations
    expect(solidity).toContain("event Transfer(address from, address to, uint256 value);");
    expect(solidity).toContain("event Approval(address owner, address spender, uint256 value);");

    // Verify nested mapping
    expect(solidity).toContain("mapping(address => mapping(address => uint256)) internal allowances;");

    // Verify all ERC20 functions
    expect(solidity).toContain("function transfer(address to, uint256 amount) public virtual returns (bool)");
    expect(solidity).toContain("function approve(address spender, uint256 amount) public virtual returns (bool)");
    expect(solidity).toContain("function transferFrom(address from, address to, uint256 amount) public virtual returns (bool)");
    expect(solidity).toContain("function balanceOf(address account) public view virtual returns (uint256)");
    expect(solidity).toContain("function allowance(address owner, address spender) public view virtual returns (uint256)");

    // Verify emit statements
    expect(solidity).toContain("emit Transfer(sender, to, amount);");
    expect(solidity).toContain("emit Approval(msg.sender, spender, amount);");
    expect(solidity).toContain("emit Transfer(from, to, amount);");

    // Verify require patterns
    expect(solidity).toContain('require((balances[sender] >= amount), "ERC20: transfer amount exceeds balance");');
    expect(solidity).toContain('require((allowances[from][spender] >= amount), "ERC20: insufficient allowance");');

    // Verify ABI
    const abiNames = (abi as { name?: string; type?: string }[]);
    const fnNames = abiNames.filter(i => i.name).map(i => i.name);
    expect(fnNames).toContain("transfer");
    expect(fnNames).toContain("approve");
    expect(fnNames).toContain("transferFrom");
    expect(fnNames).toContain("balanceOf");
    expect(fnNames).toContain("allowance");
    expect(fnNames).toContain("name");
    expect(fnNames).toContain("symbol");
    expect(fnNames).toContain("decimals");
    expect(fnNames).toContain("totalSupply");

    // Verify events in ABI
    const eventNames = abiNames.filter(i => i.type === "event").map(i => i.name);
    expect(eventNames).toContain("Transfer");
    expect(eventNames).toContain("Approval");
  });
});

describe("integration: ultimate combined test", () => {
  it("should compile a complex token with inheritance, events, private methods, immutable, arrays, Number.MAX_VALUE, ternary, while loop, and cross-function mutability", () => {
    const source = `
      class Ownable {
        public readonly owner: address;

        constructor() {
          this.owner = msg.sender;
        }

        public getOwner(): address {
          return this.owner;
        }
      }

      class AdvancedToken extends Ownable {
        Transfer: SkittlesEvent<{ from: address; to: address; value: number }>;
        Approval: SkittlesEvent<{ owner: address; spender: address; value: number }>;

        public name: string = "AdvancedToken";
        public symbol: string = "ADV";
        public readonly decimals: number = 18;
        public totalSupply: number = 0;
        private balances: Record<address, number> = {};
        private allowances: Record<address, Record<address, number>> = {};
        public holders: address[] = [];

        constructor(initialSupply: number) {
          this.totalSupply = initialSupply;
          this.balances[msg.sender] = initialSupply;
          this.holders.push(msg.sender);
        }

        public balanceOf(account: address): number {
          return this.balances[account];
        }

        public allowance(owner: address, spender: address): number {
          return this.allowances[owner][spender];
        }

        private _transfer(from: address, to: address, amount: number): void {
          if (this.balances[from] < amount) {
            throw new Error("Insufficient balance");
          }
          this.balances[from] -= amount;
          this.balances[to] += amount;
          this.Transfer.emit({ from, to, value: amount });
        }

        public transfer(to: address, amount: number): boolean {
          this._transfer(msg.sender, to, amount);
          return true;
        }

        public approve(spender: address, amount: number): boolean {
          this.allowances[msg.sender][spender] = amount;
          this.Approval.emit({ owner: msg.sender, spender, value: amount });
          return true;
        }

        public transferFrom(from: address, to: address, amount: number): boolean {
          const spender: address = msg.sender;
          if (this.allowances[from][spender] < amount) {
            throw new Error("Insufficient allowance");
          }
          if (this.allowances[from][spender] !== Number.MAX_VALUE) {
            this.allowances[from][spender] -= amount;
          }
          this._transfer(from, to, amount);
          return true;
        }

        public holderCount(): number {
          return this.holders.length;
        }

        public max(a: number, b: number): number {
          return a > b ? a : b;
        }
      }
    `;

    const contracts = parse(source, "test.ts");
    expect(contracts).toHaveLength(2);

    const ownable = contracts[0];
    expect(ownable.name).toBe("Ownable");
    expect(ownable.variables.find(v => v.name === "owner")!.immutable).toBe(true);

    const token = contracts[1];
    expect(token.name).toBe("AdvancedToken");
    expect(token.inherits).toEqual(["Ownable"]);
    expect(token.events).toHaveLength(2);

    // Verify mutability propagation: transfer calls _transfer which mutates state
    const _transfer = token.functions.find(f => f.name === "_transfer");
    const transfer = token.functions.find(f => f.name === "transfer");
    const transferFrom = token.functions.find(f => f.name === "transferFrom");
    const balanceOf = token.functions.find(f => f.name === "balanceOf");
    const maxFn = token.functions.find(f => f.name === "max");

    expect(_transfer!.stateMutability).toBe("nonpayable");
    expect(transfer!.stateMutability).toBe("nonpayable");
    expect(transferFrom!.stateMutability).toBe("nonpayable");
    expect(balanceOf!.stateMutability).toBe("view");
    expect(maxFn!.stateMutability).toBe("pure");

    // Now compile through solc
    const solidity = generateSolidityFile(contracts);
    const result = compileSolidity("AdvancedToken", solidity, defaultConfig);

    expect(result.errors).toHaveLength(0);
    expect(result.bytecode.length).toBeGreaterThan(0);

    // Verify Solidity output
    expect(solidity).toContain("contract Ownable {");
    expect(solidity).toContain("address public immutable owner;");
    expect(solidity).toContain("contract AdvancedToken is Ownable {");

    expect(solidity).toContain("event Transfer(address from, address to, uint256 value);");
    expect(solidity).toContain("event Approval(address owner, address spender, uint256 value);");

    expect(solidity).toContain("uint256 public immutable decimals = 18;");
    expect(solidity).toContain("address[] public holders;");
    expect(solidity).toContain("mapping(address => mapping(address => uint256)) internal allowances;");

    // Cross-function propagation: transfer must not be view
    expect(solidity).toContain("function _transfer(address from, address to, uint256 amount) internal virtual {");
    expect(solidity).toContain("function transfer(address to, uint256 amount) public virtual returns (bool)");
    expect(solidity).not.toMatch(/function transfer\(.*\) public view/);

    // Number.MAX_VALUE
    expect(solidity).toContain("type(uint256).max");

    // Ternary
    expect(solidity).toContain("function max(uint256 a, uint256 b) public pure virtual returns (uint256)");

    // Array operations
    expect(solidity).toContain("holders.push(msg.sender);");
    expect(solidity).toContain("return holders.length;");

    // Verify ABI completeness
    const abiNames = (result.abi as { name?: string; type?: string }[]);
    const fnNames = abiNames.filter(i => i.name).map(i => i.name);
    expect(fnNames).toContain("transfer");
    expect(fnNames).toContain("approve");
    expect(fnNames).toContain("transferFrom");
    expect(fnNames).toContain("balanceOf");
    expect(fnNames).toContain("allowance");
    expect(fnNames).toContain("holderCount");
    expect(fnNames).toContain("max");
    expect(fnNames).toContain("name");
    expect(fnNames).toContain("symbol");
    expect(fnNames).toContain("totalSupply");

    const eventNamesABI = abiNames.filter(i => i.type === "event").map(i => i.name);
    expect(eventNamesABI).toContain("Transfer");
    expect(eventNamesABI).toContain("Approval");
  });
});

// ============================================================
// Bitwise operators
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

describe("integration: control flow", () => {
  it("should compile break in a for loop", () => {
    const { errors, solidity } = compileTS(`
      class Control {
        public findFirst(target: number): number {
          for (let i: number = 0; i < 100; i++) {
            if (i === target) {
              break;
            }
          }
          return 0;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("break;");
  });

  it("should compile continue in a for loop", () => {
    const { errors, solidity } = compileTS(`
      class Control {
        public sumOdds(): number {
          let total: number = 0;
          for (let i: number = 0; i < 10; i++) {
            if (i % 2 === 0) {
              continue;
            }
            total += i;
          }
          return total;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("continue;");
  });

  it("should compile do-while loop", () => {
    const { errors, solidity } = compileTS(`
      class Control {
        public countdown(n: number): number {
          let i: number = n;
          do {
            i -= 1;
          } while (i > 0);
          return i;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("do {");
    expect(solidity).toContain("} while ((i > 0));");
  });
});

// ============================================================
// Multiple variable declarations
// ============================================================

// ============================================================
// Indexed event parameters
// ============================================================

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
    expect(solidity).toContain("event Transfer(address indexed from, address indexed to, uint256 value);");
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

describe("integration: constant state variables", () => {
  it("should compile static readonly as constant", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        static readonly MAX_SUPPLY: number = 1000000;
        static readonly TOKEN_NAME: string = "MyToken";

        public getMax(): number {
          return Token.MAX_SUPPLY;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("uint256 public constant MAX_SUPPLY = 1000000;");
    expect(solidity).toContain('string public constant TOKEN_NAME = "MyToken";');
  });

  it("should keep readonly (non-static) as immutable", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        readonly owner: address = msg.sender;
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("address public immutable owner");
  });
});

// ============================================================
// Built-in functions
// ============================================================

describe("integration: built-in functions", () => {
  it("should compile keccak256 to keccak256(abi.encodePacked(...))", () => {
    const contracts = parse(`
      class Hasher {
        public hash(a: number, b: number): void {
          let h = keccak256(a, b);
        }
      }
    `, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("keccak256(abi.encodePacked(a, b))");
  });

  it("should compile abi.encodePacked", () => {
    const contracts = parse(`
      class Encoder {
        public encode(a: number, b: number): void {
          let d = abi.encodePacked(a, b);
        }
      }
    `, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("abi.encodePacked(a, b)");
  });

  it("should compile assert", () => {
    const { errors, solidity } = compileTS(`
      class Checker {
        public check(x: number): void {
          assert(x > 0);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("assert((x > 0))");
  });

  it("should compile hash() as keccak256(abi.encodePacked(...))", () => {
    const contracts = parse(`
      class Hasher {
        public singleHash(a: number): void {
          let h = hash(a);
        }
        public multiHash(a: number, b: address, c: boolean): void {
          let h = hash(a, b, c);
        }
      }
    `, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("keccak256(abi.encodePacked(a))");
    expect(solidity).toContain("keccak256(abi.encodePacked(a, b, c))");
  });

  it("should compile string.concat", () => {
    const { errors, solidity } = compileTS(`
      class Concat {
        public join(a: string, b: string): string {
          return string.concat(a, b);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("string.concat(a, b)");
  });
});

// ============================================================
// Structs
// ============================================================

describe("integration: structs", () => {
  it("should compile type aliases as Solidity structs", () => {
    const { errors, solidity } = compileTS(`
      type Point = {
        x: number;
        y: number;
      };

      class Geometry {
        public origin: Point;

        public getOrigin(): Point {
          return this.origin;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("struct Point {");
    expect(solidity).toContain("uint256 x;");
    expect(solidity).toContain("uint256 y;");
    expect(solidity).toContain("Point public origin;");
    expect(solidity).toContain("returns (Point memory)");
  });

  it("should use memory annotation for struct parameters", () => {
    const { errors, solidity } = compileTS(`
      type Transfer = {
        from: address;
        to: address;
        amount: number;
      };

      class Bank {
        public process(t: Transfer): void {
          let from: address = t.from;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("Transfer memory t");
  });
});

// ============================================================
// Enums
// ============================================================

describe("integration: enums", () => {
  it("should compile TypeScript enums to Solidity enums", () => {
    const { errors, solidity } = compileTS(`
      enum Status { Pending, Active, Closed }

      class Proposal {
        public status: Status;

        public activate(): void {
          this.status = Status.Active;
        }

        public getStatus(): Status {
          return this.status;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("enum Status { Pending, Active, Closed }");
    expect(solidity).toContain("Status public status;");
    expect(solidity).toContain("returns (Status)");
  });
});

// ============================================================
// virtual / override
// ============================================================

describe("integration: virtual and override", () => {
  it("should auto-mark functions as virtual", () => {
    const { errors, solidity } = compileTS(`
      class Base {
        public getValue(): number {
          return 42;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function getValue() public pure virtual returns (uint256)");
  });

  it("should mark overridden functions with override", () => {
    const source = `
      class Base {
        public getValue(): number {
          return 42;
        }
      }

      class Child extends Base {
        public override getValue(): number {
          return 100;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidityFile(contracts);
    const result = compileSolidity("Child", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
    expect(solidity).toContain("function getValue() public pure virtual returns (uint256)");
    expect(solidity).toContain("function getValue() public pure override returns (uint256)");
  });
});

// ============================================================
// super keyword
// ============================================================

describe("integration: super keyword", () => {
  it("should compile super.method() calls", () => {
    const source = `
      class Base {
        public getValue(): number {
          return 42;
        }
      }

      class Child extends Base {
        public override getValue(): number {
          let base: number = super.getValue();
          return base + 1;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidityFile(contracts);
    expect(solidity).toContain("super.getValue()");
  });
});

// ============================================================
// receive and fallback
// ============================================================

describe("integration: receive and fallback", () => {
  it("should compile receive function", () => {
    const { errors, solidity } = compileTS(`
      class Receiver {
        private total: number = 0;

        public receive(): void {
          this.total += msg.value;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("receive() external payable {");
    expect(solidity).toContain("total += msg.value;");
  });

  it("should compile fallback function", () => {
    const { errors, solidity } = compileTS(`
      class Proxy {
        public fallback(): void {
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("fallback() external payable {");
  });
});

// ============================================================
// Type casting
// ============================================================

describe("integration: type casting", () => {
  it("should pass through address() cast", () => {
    const contracts = parse(`
      class Caster {
        public getAddr(): address {
          return address(this);
        }
      }
    `, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("address(this)");
  });

  it("should handle angle bracket type assertions transparently", () => {
    const contracts = parse(`
      class Caster {
        public cast(x: number): number {
          return <number>x;
        }
      }
    `, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("return x;");
  });
});

// ============================================================
// Custom errors
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
    expect(solidity).toContain("error InsufficientBalance(uint256 available, uint256 required);");
    expect(solidity).toContain("revert InsufficientBalance(balances[msg.sender], amount);");
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
    expect(solidity).toContain("error InsufficientBalance(address sender, uint256 balance, uint256 required);");
    expect(solidity).toContain("revert InsufficientBalance(msg.sender, balances[msg.sender], amount);");
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
    const contracts = parse(`
      class Token {
        NotOwner: SkittlesError<{ caller: address }>;
        public value: number = 0;
      }
    `, "test.ts");
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
});

// ============================================================
// Arrow function class properties
// ============================================================

describe("integration: arrow function class properties", () => {
  it("should compile arrow function properties as methods", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        private balances: Record<address, number> = {};

        private _transfer = (from: address, to: address, amount: number): void => {
          this.balances[from] -= amount;
          this.balances[to] += amount;
        }

        public transfer(to: address, amount: number): void {
          this._transfer(msg.sender, to, amount);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function _transfer(address from, address to, uint256 amount) internal virtual {");
    expect(solidity).toContain("function transfer(address to, uint256 amount) public virtual {");
    expect(solidity).toContain("balances[from] -= amount;");
    expect(solidity).toContain("balances[to] += amount;");
  });

  it("should compile public arrow function properties", () => {
    const { errors, solidity } = compileTS(`
      class Math {
        public add = (a: number, b: number): number => {
          return a + b;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function add(uint256 a, uint256 b) public pure virtual returns (uint256)");
  });

  it("should infer state mutability for arrow function properties", () => {
    const contracts = parse(`
      class Counter {
        public count: number = 0;

        public increment = (): void => {
          this.count += 1;
        }

        public getCount = (): number => {
          return this.count;
        }
      }
    `, "test.ts");
    const inc = contracts[0].functions.find(f => f.name === "increment");
    const get = contracts[0].functions.find(f => f.name === "getCount");
    expect(inc!.stateMutability).toBe("nonpayable");
    expect(get!.stateMutability).toBe("view");
  });
});

// ============================================================
// Switch/case/default
// ============================================================

describe("integration: switch/case/default", () => {
  it("should compile switch/case to if/else if chains", () => {
    const { errors, solidity } = compileTS(`
      class Router {
        public route(action: number): number {
          switch (action) {
            case 0:
              return 100;
            case 1:
              return 200;
            case 2:
              return 300;
            default:
              return 0;
          }
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("if (action == 0)");
    expect(solidity).toContain("return 100;");
    expect(solidity).toContain("} else if (action == 1)");
    expect(solidity).toContain("return 200;");
    expect(solidity).toContain("} else if (action == 2)");
    expect(solidity).toContain("return 300;");
    expect(solidity).toContain("} else {");
    expect(solidity).toContain("return 0;");
  });

  it("should compile switch without default", () => {
    const { errors, solidity } = compileTS(`
      class Handler {
        public value: number = 0;
        public handle(code: number): void {
          switch (code) {
            case 1:
              this.value = 10;
              break;
            case 2:
              this.value = 20;
              break;
          }
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("if (code == 1)");
    expect(solidity).toContain("value = 10;");
    expect(solidity).toContain("} else if (code == 2)");
    expect(solidity).toContain("value = 20;");
  });
});

// ============================================================
// Static class methods
// ============================================================

describe("integration: static class methods", () => {
  it("should compile static methods as internal functions", () => {
    const { errors, solidity } = compileTS(`
      class MathLib {
        public static add(a: number, b: number): number {
          return a + b;
        }

        public static mul(a: number, b: number): number {
          return a * b;
        }

        public compute(x: number, y: number): number {
          return MathLib.add(x, MathLib.mul(x, y));
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function add(uint256 a, uint256 b) internal pure virtual returns (uint256)");
    expect(solidity).toContain("function mul(uint256 a, uint256 b) internal pure virtual returns (uint256)");
  });
});

// ============================================================
// const declarations
// ============================================================

describe("integration: const declarations", () => {
  it("should compile const the same as let", () => {
    const { errors, solidity } = compileTS(`
      class Test {
        public calc(x: number): number {
          const doubled: number = x * 2;
          const tripled: number = x * 3;
          return doubled + tripled;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("uint256 doubled = (x * 2);");
    expect(solidity).toContain("uint256 tripled = (x * 3);");
    expect(solidity).toContain("return (doubled + tripled);");
  });

  it("should compile const with type inference", () => {
    const contracts = parse(`
      class Test {
        public getSender(): address {
          const s: address = msg.sender;
          return s;
        }
      }
    `, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("address s = msg.sender;");
  });
});

// ============================================================
// Void operator
// ============================================================

describe("integration: void operator", () => {
  it("should handle void operator by keeping the expression", () => {
    const contracts = parse(`
      class Test {
        public value: number = 0;
        public doSomething(): void {
          void (this.value = 5);
        }
      }
    `, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("value = 5;");
  });
});

// ============================================================
// Comma operator
// ============================================================

describe("integration: comma operator", () => {
  it("should handle comma operator by using the last value", () => {
    const contracts = parse(`
      class Test {
        public getVal(): number {
          return (1, 2, 3);
        }
      }
    `, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("return 3;");
  });
});

// ============================================================
// Getter/setter accessors
// ============================================================

describe("integration: getter/setter accessors", () => {
  it("should compile get accessor as view function", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        private _balance: number = 0;

        public get balance(): number {
          return this._balance;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function balance() public view virtual returns (uint256)");
    expect(solidity).toContain("return _balance;");
  });

  it("should compile set accessor as mutating function", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        private _balance: number = 0;

        public set balance(value: number) {
          this._balance = value;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function balance(uint256 value) public virtual {");
    expect(solidity).toContain("_balance = value;");
  });

  it("should compile paired getter and setter", () => {
    const { errors, solidity } = compileTS(`
      class Config {
        private _threshold: number = 0;

        public get threshold(): number {
          return this._threshold;
        }

        public set threshold(val: number) {
          this._threshold = val;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function threshold() public view virtual returns (uint256)");
    expect(solidity).toContain("function threshold(uint256 val) public virtual {");
  });
});

// ============================================================
// Null and undefined literals
// ============================================================

describe("integration: null and undefined", () => {
  it("should compile null as zero value", () => {
    const { errors, solidity } = compileTS(`
      class Nullable {
        public value: number = 0;
        public reset(): void {
          this.value = null as any;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("value = 0;");
  });

  it("should handle null in comparisons", () => {
    const contracts = parse(`
      class Checker {
        public isZero(x: number): boolean {
          return x == null as any;
        }
      }
    `, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("(x == 0)");
  });
});

// ============================================================
// Delete expressions
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
    const contracts = parse(`
      class Registry {
        private data: Record<address, number> = {};

        public remove(addr: address): void {
          delete this.data[addr];
        }
      }
    `, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("nonpayable");
  });
});

// ============================================================
// For...of loops
// ============================================================

describe("integration: for...of loops", () => {
  it("should compile for...of to indexed for loop", () => {
    const { errors, solidity } = compileTS(`
      class Summer {
        public items: number[] = [];

        public sum(): number {
          let total: number = 0;
          for (const item of this.items) {
            total += item;
          }
          return total;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("for (uint256 _i_item = 0; (_i_item < items.length); _i_item++)");
    expect(solidity).toContain("uint256 item = items[_i_item];");
    expect(solidity).toContain("total += item;");
  });

  it("should compile for...of with typed variable", () => {
    const contracts = parse(`
      class Registry {
        public addrs: address[] = [];

        public findAddr(target: address): boolean {
          for (const addr of this.addrs) {
            if (addr == target) {
              return true;
            }
          }
          return false;
        }
      }
    `, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("_i_addr");
    expect(solidity).toContain("addrs[_i_addr]");
  });
});

// ============================================================
// Object literal / struct construction
// ============================================================

describe("integration: object literal struct construction", () => {
  it("should compile object literal as struct constructor in variable declaration", () => {
    const { errors, solidity } = compileTS(`
      type Point = {
        x: number;
        y: number;
      };

      class Geometry {
        public createPoint(): Point {
          let p: Point = { x: 1, y: 2 };
          return p;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("Point memory p = Point(1, 2);");
  });

  it("should compile object literal with shorthand properties", () => {
    const contracts = parse(`
      type Point = {
        x: number;
        y: number;
      };

      class Geometry {
        public createPoint(x: number, y: number): Point {
          let p: Point = { x, y };
          return p;
        }
      }
    `, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("Point memory p = Point(x, y);");
  });
});

// ============================================================
// Template literals
// ============================================================

describe("integration: template literals", () => {
  it("should compile template literals to string.concat", () => {
    const { errors, solidity } = compileTS(`
      class Greeter {
        public greet(name: string): string {
          return \`Hello \${name}\`;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain('string.concat("Hello ", name)');
  });

  it("should compile template literals with multiple expressions", () => {
    const contracts = parse(`
      class Formatter {
        public format(a: string, b: string): string {
          return \`\${a} and \${b}\`;
        }
      }
    `, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain('string.concat(a, " and ", b)');
  });

  it("should compile no-substitution template literals as regular strings", () => {
    const { errors, solidity } = compileTS(`
      class Simple {
        public name: string = \`hello\`;
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain('string public name = "hello"');
  });
});

describe("integration: multiple variable declarations", () => {
  it("should compile let a=1, b=2 as separate statements", () => {
    const { errors, solidity } = compileTS(`
      class Multi {
        public test(): number {
          let a: number = 1, b: number = 2, c: number = 3;
          return a + b + c;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("uint256 a = 1;");
    expect(solidity).toContain("uint256 b = 2;");
    expect(solidity).toContain("uint256 c = 3;");
  });
});

// ============================================================
// Cross-file type resolution (collectTypes + externalTypes)
// ============================================================

describe("integration: cross-file type resolution", () => {
  it("should collect structs from an external source and use them in a contract", () => {
    const typesSource = `
      type Position = {
        x: number;
        y: number;
      };
    `;
    const contractSource = `
      class Game {
        public getOrigin(): Position {
          let p: Position = { x: 0, y: 0 };
          return p;
        }
      }
    `;

    const { structs, enums } = collectTypes(typesSource, "types.ts");
    const contracts = parse(contractSource, "game.ts", { structs, enums });
    expect(contracts).toHaveLength(1);

    const solidity = generateSolidity(contracts[0]);
    const result = compileSolidity(contracts[0].name, solidity, defaultConfig);

    expect(result.errors).toHaveLength(0);
    expect(solidity).toContain("struct Position {");
    expect(solidity).toContain("uint256 x;");
    expect(solidity).toContain("uint256 y;");
    expect(solidity).toContain("function getOrigin() public pure virtual returns (Position memory)");
    expect(solidity).toContain("Position memory p = Position(0, 0);");
  });

  it("should collect enums from an external source", () => {
    const typesSource = `
      enum Color { Red, Green, Blue }
    `;
    const contractSource = `
      class Palette {
        public color: Color;
      }
    `;

    const { structs, enums } = collectTypes(typesSource, "types.ts");
    const contracts = parse(contractSource, "palette.ts", { structs, enums });
    expect(contracts).toHaveLength(1);

    const solidity = generateSolidity(contracts[0]);
    const result = compileSolidity(contracts[0].name, solidity, defaultConfig);

    expect(result.errors).toHaveLength(0);
    expect(solidity).toContain("enum Color { Red, Green, Blue }");
    expect(solidity).toContain("Color public color;");
  });

  it("should merge external types with local types", () => {
    const typesSource = `
      type Coord = {
        x: number;
        y: number;
      };
    `;
    const contractSource = `
      type Size = {
        width: number;
        height: number;
      };
      class Canvas {
        public getCoord(): Coord {
          let c: Coord = { x: 1, y: 2 };
          return c;
        }
        public getSize(): Size {
          let s: Size = { width: 100, height: 200 };
          return s;
        }
      }
    `;

    const { structs, enums } = collectTypes(typesSource, "types.ts");
    const contracts = parse(contractSource, "canvas.ts", { structs, enums });
    const solidity = generateSolidity(contracts[0]);
    const result = compileSolidity(contracts[0].name, solidity, defaultConfig);

    expect(result.errors).toHaveLength(0);
    expect(solidity).toContain("struct Coord {");
    expect(solidity).toContain("struct Size {");
  });

  it("collectTypes should return empty maps for files with no types or enums", () => {
    const source = `
      class Standalone {
        public value: number = 0;
      }
    `;
    const { structs, enums } = collectTypes(source, "standalone.ts");
    expect(structs.size).toBe(0);
    expect(enums.size).toBe(0);
  });
});

// ============================================================
// Standalone / free functions
// ============================================================

describe("integration: standalone functions", () => {
  it("should compile file level function declarations as internal helpers", () => {
    const { errors, solidity } = compileTS(`
      function add(a: number, b: number): number {
        return a + b;
      }

      class Calculator {
        public calculate(x: number, y: number): number {
          return add(x, y);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function add(uint256 a, uint256 b) internal pure returns (uint256)");
    expect(solidity).toContain("function calculate(uint256 x, uint256 y) public pure virtual returns (uint256)");
    expect(solidity).toContain("return add(x, y);");
  });

  it("should compile file level arrow functions as internal helpers", () => {
    const { errors, solidity } = compileTS(`
      const multiply = (a: number, b: number): number => {
        return a * b;
      };

      class Calculator {
        public calc(x: number, y: number): number {
          return multiply(x, y);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function multiply(uint256 a, uint256 b) internal pure returns (uint256)");
    expect(solidity).toContain("return multiply(x, y);");
  });

  it("should compile file level expression body arrow functions", () => {
    const { errors, solidity } = compileTS(`
      const double = (x: number): number => x * 2;

      class Math {
        public getDouble(n: number): number {
          return double(n);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function double(uint256 x) internal pure returns (uint256)");
  });
});

// ============================================================
// File level constants
// ============================================================

describe("integration: file level constants", () => {
  it("should inline file level constants in expressions", () => {
    const { errors, solidity } = compileTS(`
      const ZERO_ADDRESS: address = "0x0000000000000000000000000000000000000000";

      class Registry {
        public getZero(): address {
          return ZERO_ADDRESS;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("return address(0x0000000000000000000000000000000000000000);");
  });

  it("should inline numeric file level constants", () => {
    const { errors, solidity } = compileTS(`
      const MAX_ITEMS = 100;

      class Limiter {
        public getMax(): number {
          return MAX_ITEMS;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("return 100;");
  });
});

// ============================================================
// implements keyword
// ============================================================

// ============================================================
// Public mapping auto getter
// ============================================================

describe("integration: public mapping auto getter", () => {
  it("should generate public mapping with auto getter in ABI", () => {
    const { errors, solidity, abi } = compileTS(`
      class Registry {
        public balances: Record<address, number> = {};

        public deposit(): void {
          this.balances[msg.sender] += msg.value;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("mapping(address => uint256) public balances;");

    // Verify ABI includes auto generated getter for public mapping
    const balancesGetter = (abi as any[]).find((i: any) => i.name === "balances" && i.type === "function");
    expect(balancesGetter).toBeDefined();
    expect(balancesGetter.inputs).toHaveLength(1);
    expect(balancesGetter.inputs[0].type).toBe("address");
    expect(balancesGetter.outputs).toHaveLength(1);
    expect(balancesGetter.outputs[0].type).toBe("uint256");
  });

  it("should generate nested public mapping with correct getter signature", () => {
    const { errors, solidity, abi } = compileTS(`
      class Token {
        public allowances: Record<address, Record<address, number>> = {};

        public approve(spender: address, amount: number): void {
          this.allowances[msg.sender][spender] = amount;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("mapping(address => mapping(address => uint256)) public allowances;");

    // Nested mapping getter takes two address args
    const getter = (abi as any[]).find((i: any) => i.name === "allowances" && i.type === "function");
    expect(getter).toBeDefined();
    expect(getter.inputs).toHaveLength(2);
    expect(getter.inputs[0].type).toBe("address");
    expect(getter.inputs[1].type).toBe("address");
    expect(getter.outputs[0].type).toBe("uint256");
  });
});

// ============================================================
// Boolean return type verification
// ============================================================

describe("integration: boolean return types", () => {
  it("should compile boolean return type as returns (bool)", () => {
    const { errors, solidity } = compileTS(`
      class BoolTest {
        public isTrue(): boolean {
          return true;
        }
        public isFalse(): boolean {
          return false;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function isTrue() public pure virtual returns (bool)");
    expect(solidity).toContain("function isFalse() public pure virtual returns (bool)");
    expect(solidity).toContain("return true;");
    expect(solidity).toContain("return false;");
  });

  it("should compile boolean parameters and returns correctly through solc", () => {
    const { errors, solidity, abi } = compileTS(`
      class BoolContract {
        public value: boolean = false;

        public check(a: boolean, b: boolean): boolean {
          return a && b;
        }

        public toggle(): void {
          this.value = !this.value;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function check(bool a, bool b) public pure virtual returns (bool)");

    // Verify ABI has correct bool types
    const checkFn = (abi as any[]).find((i: any) => i.name === "check");
    expect(checkFn).toBeDefined();
    expect(checkFn.inputs[0].type).toBe("bool");
    expect(checkFn.inputs[1].type).toBe("bool");
    expect(checkFn.outputs[0].type).toBe("bool");
  });
});

// ============================================================
// self / address(this)
// ============================================================

describe("integration: self keyword", () => {
  it("should compile self as address(this)", () => {
    const { errors, solidity } = compileTS(`
      class SelfAware {
        public myAddress: address;

        public recordAddress(): void {
          this.myAddress = self;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("myAddress = address(this);");
  });

  it("should compile address(this) pass through", () => {
    const contracts = parse(`
      class Caster {
        public getAddr(): address {
          return address(this);
        }
      }
    `, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("address(this)");
  });
});

// ============================================================
// Array destructuring
// ============================================================

describe("integration: array destructuring", () => {
  it("should compile const [a, b, c] = [7, 8, 9] as separate declarations", () => {
    const { errors, solidity } = compileTS(`
      class Test {
        public getValues(): number {
          const [a, b, c] = [7, 8, 9];
          return a + b + c;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("uint256 a = 7;");
    expect(solidity).toContain("uint256 b = 8;");
    expect(solidity).toContain("uint256 c = 9;");
    expect(solidity).toContain("return ((a + b) + c);");
  });

  it("should compile conditional array destructuring", () => {
    const { errors, solidity } = compileTS(`
      class Sorter {
        public sort(first: number, second: number): number {
          let [a, b] = first > second ? [second, first] : [first, second];
          return a + b;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("uint256 a = ((first > second) ? second : first);");
    expect(solidity).toContain("uint256 b = ((first > second) ? first : second);");
  });
});

// ============================================================
// Cross file function imports
// ============================================================

describe("integration: cross file function imports", () => {
  it("should use functions collected from another file", () => {
    const librarySource = `
      function add(a: number, b: number): number {
        return a + b;
      }

      const multiply = (a: number, b: number): number => a * b;
    `;
    const contractSource = `
      class Calculator {
        public sum(x: number, y: number): number {
          return add(x, y);
        }
        public product(x: number, y: number): number {
          return multiply(x, y);
        }
      }
    `;

    const { structs, enums } = collectTypes(librarySource, "library.ts");
    const { functions, constants } = collectFunctions(librarySource, "library.ts");

    const contracts = parse(contractSource, "calc.ts", { structs, enums }, { functions, constants });
    expect(contracts).toHaveLength(1);

    const solidity = generateSolidity(contracts[0]);
    const result = compileSolidity(contracts[0].name, solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
    expect(solidity).toContain("function add(uint256 a, uint256 b) internal pure returns (uint256)");
    expect(solidity).toContain("function multiply(uint256 a, uint256 b) internal pure returns (uint256)");
    expect(solidity).toContain("return add(x, y);");
    expect(solidity).toContain("return multiply(x, y);");
  });
});

// ============================================================
// Cross file constant imports
// ============================================================

describe("integration: cross file constant imports", () => {
  it("should inline constants collected from another file", () => {
    const constantsSource = `
      const ZERO_ADDRESS: address = "0x0000000000000000000000000000000000000000";
      const MAX_SUPPLY = 1000000;
    `;
    const contractSource = `
      class Token {
        public maxSupply: number = 0;

        public getMax(): number {
          return MAX_SUPPLY;
        }

        public getZero(): address {
          return ZERO_ADDRESS;
        }
      }
    `;

    const { structs, enums } = collectTypes(constantsSource, "constants.ts");
    const { functions, constants } = collectFunctions(constantsSource, "constants.ts");

    const contracts = parse(contractSource, "token.ts", { structs, enums }, { functions, constants });
    const solidity = generateSolidity(contracts[0]);
    const result = compileSolidity(contracts[0].name, solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
    expect(solidity).toContain("return 1000000;");
    expect(solidity).toContain("return address(0x0000000000000000000000000000000000000000);");
  });
});

// ============================================================
// implements keyword
// ============================================================

describe("integration: implements keyword", () => {
  it("should compile implements as Solidity is with correct mutability and override", () => {
    const source = `
      interface IToken {
        balance(account: address): number;
      }

      class Token implements IToken {
        public balances: Record<address, number> = {};

        public balance(account: address): number {
          return this.balances[account];
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts).toHaveLength(1);
    expect(contracts[0].name).toBe("Token");
    expect(contracts[0].inherits).toEqual(["IToken"]);
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("interface IToken {");
    expect(solidity).toContain("function balance(address account) external view returns (uint256);");
    expect(solidity).toContain("contract Token is IToken {");
    expect(solidity).toContain("function balance(address account) public view override");
  });

  it("should accept combined extends and implements", () => {
    const source = `
      class Base {
        public value: number = 0;

        public getValue(): number {
          return this.value;
        }
      }

      class Child extends Base {
        public override getValue(): number {
          return this.value + 1;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts).toHaveLength(2);
    expect(contracts[1].inherits).toEqual(["Base"]);

    const solidity = generateSolidityFile(contracts);
    const result = compileSolidity("Child", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================
// Contract interfaces
// ============================================================

describe("integration: contract interfaces", () => {
  it("should compile interfaces with methods as Solidity interfaces", () => {
    const source = `
      interface IToken {
        name(): string;
        symbol(): string;
        totalSupply(): number;
        balanceOf(account: address): number;
        transfer(to: address, amount: number): boolean;
      }

      class Token implements IToken {
        private _name: string = "Token";
        private _symbol: string = "TKN";
        private _totalSupply: number = 0;
        private balances: Record<address, number> = {};

        public name(): string {
          return this._name;
        }

        public symbol(): string {
          return this._symbol;
        }

        public totalSupply(): number {
          return this._totalSupply;
        }

        public balanceOf(account: address): number {
          return this.balances[account];
        }

        public transfer(to: address, amount: number): boolean {
          this.balances[to] += amount;
          return true;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts).toHaveLength(1);
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("interface IToken {");
    expect(solidity).toContain("function name() external view returns (string memory);");
    expect(solidity).toContain("function balanceOf(address account) external view returns (uint256);");
    expect(solidity).toContain("function transfer(address to, uint256 amount) external returns (bool);");
    expect(solidity).toContain("contract Token is IToken {");
    // Implementing functions should have override, not virtual
    expect(solidity).toContain("function name() public view override");
    expect(solidity).toContain("function transfer(address to, uint256 amount) public override");
    expect(solidity).not.toContain("function name() public view virtual");
    const result = compileSolidity("Token", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should compile interfaces with properties as view getter functions", () => {
    const source = `
      interface IOwnable {
        owner: address;
      }

      class Ownable implements IOwnable {
        public owner: address = msg.sender;
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("interface IOwnable {");
    expect(solidity).toContain("function owner() external view returns (address);");
    expect(solidity).toContain("contract Ownable is IOwnable {");
    expect(solidity).toContain("address public override owner = msg.sender;");
    const result = compileSolidity("Ownable", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should compile interfaces with mixed properties and methods", () => {
    const source = `
      interface IToken {
        name: string;
        symbol: string;
        totalSupply: number;
        balanceOf(account: address): number;
        transfer(to: address, amount: number): boolean;
      }

      class Token implements IToken {
        public name: string = "MyToken";
        public symbol: string = "MTK";
        public totalSupply: number = 1000;
        private balances: Record<address, number> = {};

        public balanceOf(account: address): number {
          return this.balances[account];
        }

        public transfer(to: address, amount: number): boolean {
          this.balances[to] += amount;
          return true;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("interface IToken {");
    // Properties get view
    expect(solidity).toContain("function name() external view returns (string memory);");
    expect(solidity).toContain("function symbol() external view returns (string memory);");
    expect(solidity).toContain("function totalSupply() external view returns (uint256);");
    // Method mutability derived from implementation
    expect(solidity).toContain("function balanceOf(address account) external view returns (uint256);");
    expect(solidity).toContain("function transfer(address to, uint256 amount) external returns (bool);");
    expect(solidity).toContain("contract Token is IToken {");
    // Public variables get override
    expect(solidity).toContain('string public override name = "MyToken"');
    expect(solidity).toContain('string public override symbol = "MTK"');
    expect(solidity).toContain("uint256 public override totalSupply = 1000");
    // Functions get override
    expect(solidity).toContain("function balanceOf(address account) public view override");
    expect(solidity).toContain("function transfer(address to, uint256 amount) public override");
    const result = compileSolidity("Token", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should generate interface before contract in output", () => {
    const source = `
      interface IGreeter {
        greet(): string;
      }

      class Greeter implements IGreeter {
        public greet(): string {
          return "hello";
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    const ifacePos = solidity.indexOf("interface IGreeter {");
    const contractPos = solidity.indexOf("contract Greeter is IGreeter {");
    expect(ifacePos).toBeGreaterThan(-1);
    expect(contractPos).toBeGreaterThan(-1);
    expect(ifacePos).toBeLessThan(contractPos);
    expect(solidity).toContain("function greet() external pure returns (string memory);");
    expect(solidity).toContain("function greet() public pure override");
    const result = compileSolidity("Greeter", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle void return in interface methods with correct mutability", () => {
    const source = `
      interface IStore {
        set(key: number, value: number): void;
      }

      class Store implements IStore {
        private data: Record<number, number> = {};

        public set(key: number, value: number): void {
          this.data[key] = value;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("function set(uint256 key, uint256 value) external;");
    expect(solidity).toContain("function set(uint256 key, uint256 value) public override");
    const result = compileSolidity("Store", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should collect contract interfaces from external source files", () => {
    const typesSource = `
      interface ICounter {
        increment(): void;
        getCount(): number;
      }
    `;
    const contractSource = `
      class Counter implements ICounter {
        private count: number = 0;

        public increment(): void {
          this.count += 1;
        }

        public getCount(): number {
          return this.count;
        }
      }
    `;

    const { structs, enums, contractInterfaces } = collectTypes(typesSource, "types.ts");
    const contracts = parse(contractSource, "counter.ts", { structs, enums, contractInterfaces });
    expect(contracts).toHaveLength(1);
    expect(contracts[0].inherits).toEqual(["ICounter"]);

    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("interface ICounter {");
    expect(solidity).toContain("function increment() external;");
    expect(solidity).toContain("function getCount() external view returns (uint256);");
    expect(solidity).toContain("contract Counter is ICounter {");
    expect(solidity).toContain("function increment() public override");
    expect(solidity).toContain("function getCount() public view override");
    const result = compileSolidity("Counter", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should use calldata for reference type parameters in interface functions", () => {
    const source = `
      interface IRegistry {
        register(name: string): void;
        lookup(name: string): address;
      }

      class Registry implements IRegistry {
        private entries: Record<string, address> = {};

        public register(name: string): void {
          this.entries[name] = msg.sender;
        }

        public lookup(name: string): address {
          return this.entries[name];
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("function register(string calldata name) external;");
    expect(solidity).toContain("function lookup(string calldata name) external view returns (address);");
    const result = compileSolidity("Registry", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================
// Type alias structs
// ============================================================

describe("integration: type alias structs", () => {
  it("should compile type aliases with object shapes as Solidity structs", () => {
    const { errors, solidity } = compileTS(`
      type Point = {
        x: number;
        y: number;
      };

      class Geometry {
        public origin: Point;

        public getOrigin(): Point {
          return this.origin;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("struct Point {");
    expect(solidity).toContain("uint256 x;");
    expect(solidity).toContain("uint256 y;");
    expect(solidity).toContain("Point public origin;");
    expect(solidity).toContain("returns (Point memory)");
  });

  it("should compile type aliases with address fields", () => {
    const { errors, solidity } = compileTS(`
      type Transfer = {
        from: address;
        to: address;
        amount: number;
      };

      class Bank {
        public process(t: Transfer): void {
          let from: address = t.from;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("struct Transfer {");
    expect(solidity).toContain("address from;");
    expect(solidity).toContain("Transfer memory t");
  });
});

// ============================================================
// End to end solc compilation with contract interfaces
// ============================================================

describe("integration: contract interface solc compilation", () => {
  it("should produce valid Solidity that compiles through solc", () => {
    const source = `
      interface IToken {
        name: string;
        symbol: string;
        totalSupply: number;
        balanceOf(account: address): number;
        transfer(to: address, amount: number): boolean;
      }

      class Token implements IToken {
        public name: string = "MyToken";
        public symbol: string = "MTK";
        public totalSupply: number = 1000000;
        private balances: Record<address, number> = {};

        public balanceOf(account: address): number {
          return this.balances[account];
        }

        public transfer(to: address, amount: number): boolean {
          this.balances[msg.sender] -= amount;
          this.balances[to] += amount;
          return true;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    const result = compileSolidity("Token", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
    expect(result.bytecode.length).toBeGreaterThan(0);
  });

  it("should hoist structs referenced by interface signatures to file scope", () => {
    const source = `
      type TokenInfo = {
        name: string;
        totalSupply: number;
      };

      interface IRegistry {
        getTokenInfo(token: address): TokenInfo;
        register(info: TokenInfo): void;
      }

      class Registry implements IRegistry {
        private data: Record<address, TokenInfo> = {};

        public getTokenInfo(token: address): TokenInfo {
          return this.data[token];
        }

        public register(info: TokenInfo): void {
          this.data[msg.sender] = info;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);

    const structIdx = solidity.indexOf("struct TokenInfo {");
    const interfaceIdx = solidity.indexOf("interface IRegistry {");
    const contractIdx = solidity.indexOf("contract Registry");

    expect(structIdx).toBeGreaterThan(-1);
    expect(interfaceIdx).toBeGreaterThan(-1);
    expect(contractIdx).toBeGreaterThan(-1);
    expect(structIdx).toBeLessThan(interfaceIdx);
    expect(interfaceIdx).toBeLessThan(contractIdx);

    expect(solidity).toContain("function getTokenInfo(address token) external view returns (TokenInfo memory);");
    expect(solidity).toContain("function register(TokenInfo calldata info) external;");

    const result = compileSolidity("Registry", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
    expect(result.bytecode.length).toBeGreaterThan(0);
  });

  it("should not add override to constant or immutable variables matching interface properties", () => {
    const source = `
      interface IConfig {
        MAX_SUPPLY: number;
        minStake: number;
        owner: address;
      }

      class Config implements IConfig {
        public static readonly MAX_SUPPLY: number = 1000000;
        public readonly minStake: number = 100;
        public owner: address = msg.sender;
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);

    expect(solidity).toContain("uint256 public constant MAX_SUPPLY");
    expect(solidity).not.toContain("constant override");
    expect(solidity).toContain("uint256 public immutable minStake");
    expect(solidity).not.toContain("immutable override");
    expect(solidity).toContain("address public override owner");
  });
});
