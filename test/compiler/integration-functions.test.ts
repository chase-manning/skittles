import { describe, it, expect } from "vitest";
import {
  parse,
} from "../../src/compiler/parser";
import {
  generateSolidity,
} from "../../src/compiler/codegen";
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
    expect(solidity).toContain(
      "function getSupply() public view virtual returns (uint256)"
    );
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
    expect(solidity).toContain(
      "function _transfer(address from, address to, uint256 amount) internal virtual {"
    );
    expect(solidity).toContain(
      "function transfer(address to, uint256 amount) public virtual {"
    );
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
    expect(solidity).toContain(
      "function add(uint256 a, uint256 b) public pure virtual returns (uint256)"
    );
  });

  it("should infer state mutability for arrow function properties", () => {
    const contracts = parse(
      `
      class Counter {
        public count: number = 0;

        public increment = (): void => {
          this.count += 1;
        }

        public getCount = (): number => {
          return this.count;
        }
      }
    `,
      "test.ts"
    );
    const inc = contracts[0].functions.find((f) => f.name === "increment");
    const get = contracts[0].functions.find((f) => f.name === "getCount");
    expect(inc!.stateMutability).toBe("nonpayable");
    expect(get!.stateMutability).toBe("view");
  });
});

// ============================================================
// Switch/case/default
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
    expect(solidity).toContain(
      "function add(uint256 a, uint256 b) internal pure virtual returns (uint256)"
    );
    expect(solidity).toContain(
      "function mul(uint256 a, uint256 b) internal pure virtual returns (uint256)"
    );
  });
});

// ============================================================
// const declarations
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
    expect(solidity).toContain(
      "function balance() public view virtual returns (uint256)"
    );
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
    expect(solidity).toContain(
      "function balance(uint256 value) public virtual {"
    );
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
    expect(solidity).toContain(
      "function threshold() public view virtual returns (uint256)"
    );
    expect(solidity).toContain(
      "function threshold(uint256 val) public virtual {"
    );
  });

  it("should rename setter parameter that shadows a sibling function name", () => {
    const { errors, solidity } = compileTS(`
      class GetterSetterTest {
        private _paused: boolean = false;
        private _value: number = 0;

        get paused(): boolean {
          return this._paused;
        }

        set paused(value: boolean) {
          this._paused = value;
        }

        get value(): number {
          return this._value;
        }

        set value(val: number) {
          this._value = val;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    // The parameter "value" in paused(bool value) must be renamed to avoid
    // shadowing the sibling function value(). Since _value is already a state
    // variable, the rename produces __value.
    expect(solidity).toContain("uint256 internal _value");
    expect(solidity).not.toMatch(/function paused\(bool value\)/);
    expect(solidity).toMatch(/function paused\(bool __value\)/);
    expect(solidity).toContain("_paused = __value;");
    // The getter and setter for "value" itself should be unaffected.
    expect(solidity).toContain(
      "function value() public view virtual returns (uint256)"
    );
    expect(solidity).toContain("function value(uint256 val) public virtual {");
  });

  it("should rename parameter that shadows a regular function name", () => {
    const { errors, solidity } = compileTS(`
      class Contract {
        private stopped: boolean = false;

        public toggle(check: boolean): void {
          this.stopped = check;
        }

        public check(): boolean {
          return this.stopped;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    // The parameter "check" in toggle(bool check) shadows the function check().
    expect(solidity).not.toMatch(/function toggle\(bool check\)/);
    expect(solidity).toMatch(/function toggle\(bool _check\)/);
    expect(solidity).toContain(
      "function check() public view virtual returns (bool)"
    );
  });
});

// ============================================================
// Null and undefined literals
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
    expect(solidity).toContain(
      "function add(uint256 a, uint256 b) internal pure returns (uint256)"
    );
    expect(solidity).toContain(
      "function calculate(uint256 x, uint256 y) public pure virtual returns (uint256)"
    );
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
    expect(solidity).toContain(
      "function multiply(uint256 a, uint256 b) internal pure returns (uint256)"
    );
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
    expect(solidity).toContain(
      "function double(uint256 x) internal pure returns (uint256)"
    );
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
    expect(solidity).toContain(
      "return address(0x0000000000000000000000000000000000000000);"
    );
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

describe("integration: function overloading", () => {
  it("should compile overloaded methods to separate Solidity functions", () => {
    const { solidity, errors } = compileTS(`
      class Token {
        transfer(to: address, amount: number): boolean;
        transfer(to: address, amount: number, data: string): boolean;
        transfer(to: address, amount: number, data?: string): boolean {
          return true;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function transfer(address to, uint256 amount)");
    expect(solidity).toContain(
      "function transfer(address to, uint256 amount, string memory data)"
    );
  });

  it("should generate valid forwarding call for short overload", () => {
    const { solidity, errors } = compileTS(`
      class Token {
        transfer(to: address, amount: number): boolean;
        transfer(to: address, amount: number, data: string): boolean;
        transfer(to: address, amount: number, data?: string): boolean {
          return true;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    // The short overload should forward: return transfer(to, amount, "")
    expect(solidity).toContain('return transfer(to, amount, "")');
  });

  it("should compile overloads with different parameter types", () => {
    const { solidity, errors } = compileTS(`
      class Vault {
        deposit(amount: number): void;
        deposit(amount: number, receiver: address): void;
        deposit(amount?: number, receiver?: address): void {
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function deposit(uint256 amount)");
    expect(solidity).toContain(
      "function deposit(uint256 amount, address receiver)"
    );
  });

  it("should compile overloaded methods alongside normal methods", () => {
    const { solidity, errors } = compileTS(`
      class Token {
        balanceOf(account: address): number {
          return 0;
        }
        transfer(to: address, amount: number): boolean;
        transfer(to: address, amount: number, data: string): boolean;
        transfer(to: address, amount: number, data?: string): boolean {
          return true;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function balanceOf(address account)");
    expect(solidity).toContain("function transfer(address to, uint256 amount)");
    expect(solidity).toContain(
      "function transfer(address to, uint256 amount, string memory data)"
    );
  });
});

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
    const contracts = parse(
      `
      class Caster {
        public getAddr(): address {
          return address(this);
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("address(this)");
  });
});

// ============================================================
// Array destructuring
// ============================================================

