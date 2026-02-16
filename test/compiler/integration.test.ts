import { describe, it, expect } from "vitest";
import { parse } from "../../src/compiler/parser";
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
      "function add(uint256 a, uint256 b) public pure returns (uint256)"
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
    expect(solidity).toContain("function getSupply() public view returns (uint256)");
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
    expect(solidity).toContain("function increment() public {");
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
    expect(solidity).toContain("function classify(uint256 value) public pure returns (uint256)");
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
    expect(solidity).toContain("function balanceOf(address account) public view returns (uint256)");
    expect(solidity).toContain("function transfer(address to, uint256 amount) public returns (bool)");
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
    expect(solidity).toContain("function max(uint256 a, uint256 b) public pure returns (uint256)");
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
    expect(solidity).toContain("function _transfer(address from, address to, uint256 amount) internal {");
    expect(solidity).toContain("function transfer(address to, uint256 amount) public {");
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
    expect(solidity).toContain("function _transfer(address from, address to, uint256 amount) internal {");
    expect(solidity).toContain("function transfer(address to, uint256 amount) public {");
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
    expect(solidity).toContain("function transfer(address to, uint256 amount) public returns (bool)");
    expect(solidity).toContain("function approve(address spender, uint256 amount) public returns (bool)");
    expect(solidity).toContain("function transferFrom(address from, address to, uint256 amount) public returns (bool)");
    expect(solidity).toContain("function balanceOf(address account) public view returns (uint256)");
    expect(solidity).toContain("function allowance(address owner, address spender) public view returns (uint256)");

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
    expect(solidity).toContain("function _transfer(address from, address to, uint256 amount) internal {");
    expect(solidity).toContain("function transfer(address to, uint256 amount) public returns (bool)");
    expect(solidity).not.toMatch(/function transfer\(.*\) public view/);

    // Number.MAX_VALUE
    expect(solidity).toContain("type(uint256).max");

    // Ternary
    expect(solidity).toContain("function max(uint256 a, uint256 b) public pure returns (uint256)");

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
