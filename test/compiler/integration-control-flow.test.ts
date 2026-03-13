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
    expect(solidity).toContain(
      "function classify(uint256 value) public pure virtual returns (uint256)"
    );
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

  it("should compile power operator with literal base (10 ** decimals)", () => {
    const { errors, solidity } = compileTS(`
      class TokenMath {
        public scale(decimals: number): number {
          return 10 ** decimals;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("(10 ** decimals)");
  });

  it("should desugar **= compound assignment to x = x ** y", () => {
    const { errors, solidity } = compileTS(`
      class PowerAssign {
        public value: number = 1;
        public powerAssign(exp: number): void {
          this.value **= exp;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("value = (value ** exp)");
  });
});

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
    expect(solidity).toContain(
      "for (uint256 __sk_i_item = 0; (__sk_i_item < items.length); __sk_i_item++)"
    );
    expect(solidity).toContain("uint256 item = items[__sk_i_item];");
    expect(solidity).toContain("total += item;");
  });

  it("should compile for...of with typed variable", () => {
    const contracts = parse(
      `
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
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("__sk_i_addr");
    expect(solidity).toContain("addrs[__sk_i_addr]");
  });
});

// ============================================================
// for...in enum loops
// ============================================================

describe("integration: for...in enum loops", () => {
  it("should compile for...in over an enum to indexed for loop", () => {
    const { errors, solidity } = compileTS(`
      enum Status { Active, Paused, Stopped }

      class Manager {
        public counts: Record<number, number> = {};

        public initCounts(): void {
          for (const status in Status) {
            this.counts[0] += 1;
          }
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "for (uint256 __sk_i_status = 0; (__sk_i_status < 3); __sk_i_status++)"
    );
    expect(solidity).not.toContain("Status status = Status(__sk_i_status);");
  });

  it("should compile for...in with enum body using the variable", () => {
    const contracts = parse(
      `
      enum Color { Red, Green, Blue }

      class Palette {
        public colorCount: number = 0;

        public countColors(): number {
          let count: number = 0;
          for (const c in Color) {
            count += 1;
          }
          return count;
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("__sk_i_c");
    expect(solidity).not.toContain("Color c = Color(__sk_i_c);");
    expect(solidity).toContain("count += 1;");
  });

  it("should include enum cast variable when loop variable is used in body", () => {
    const { errors, solidity } = compileTS(`
      enum Priority { Low, Medium, High, Critical }

      class Example {
        public priorities: Priority[] = [];

        public collectPriorities(): void {
          for (const p in Priority) {
            this.priorities.push(p);
          }
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "for (uint256 __sk_i_p = 0; (__sk_i_p < 4); __sk_i_p++)"
    );
    expect(solidity).toContain("Priority p = Priority(__sk_i_p);");
  });

  it("should omit enum cast variable when loop variable is unused", () => {
    const { errors, solidity } = compileTS(`
      enum Priority { Low, Medium, High, Critical }

      class Example {
        public countEnumMembers(): number {
          let enumCount: number = 0;
          for (const p in Priority) {
            enumCount++;
          }
          return enumCount;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "for (uint256 __sk_i_p = 0; (__sk_i_p < 4); __sk_i_p++)"
    );
    expect(solidity).not.toContain("Priority p = Priority(__sk_i_p);");
  });
});

// ============================================================
// Object literal / struct construction
// ============================================================

describe("integration: try/catch", () => {
  it("should parse and generate try/catch with return value", () => {
    const source = `
      interface IToken {
        balanceOf(account: address): number;
      }

      class SafeReader {
        private token: IToken;

        constructor(tokenAddr: address) {
          this.token = IToken(tokenAddr);
        }

        public safeBalanceOf(account: address): number {
          try {
            const balance: number = this.token.balanceOf(account);
            return balance;
          } catch (e) {
            return 0;
          }
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts).toHaveLength(1);
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain(
      "try token.balanceOf(account) returns (uint256 balance) {"
    );
    expect(solidity).toContain("return balance;");
    expect(solidity).toContain("} catch {");
    expect(solidity).toContain("return 0;");

    const result = compileSolidity("SafeReader", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should parse and generate try/catch without return value", () => {
    const source = `
      interface IToken {
        transfer(to: address, amount: number): boolean;
      }

      class SafeSender {
        private token: IToken;
        private failed: boolean = false;

        constructor(tokenAddr: address) {
          this.token = IToken(tokenAddr);
        }

        public safeSend(to: address, amount: number): void {
          try {
            this.token.transfer(to, amount);
          } catch (e) {
            this.failed = true;
          }
        }

        public hasFailed(): boolean {
          return this.failed;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("try token.transfer(to, amount)");
    expect(solidity).toContain("} catch {");
    expect(solidity).toContain("failed = true;");

    const result = compileSolidity("SafeSender", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should parse try/catch with success body after the call", () => {
    const source = `
      interface IToken {
        balanceOf(account: address): number;
      }

      class Checker {
        private token: IToken;
        private lastBalance: number = 0;

        constructor(tokenAddr: address) {
          this.token = IToken(tokenAddr);
        }

        public checkAndStore(account: address): boolean {
          try {
            const bal: number = this.token.balanceOf(account);
            this.lastBalance = bal;
            return true;
          } catch (e) {
            return false;
          }
        }

        public getLastBalance(): number {
          return this.lastBalance;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain(
      "try token.balanceOf(account) returns (uint256 bal) {"
    );
    expect(solidity).toContain("lastBalance = bal;");
    expect(solidity).toContain("return true;");
    expect(solidity).toContain("} catch {");
    expect(solidity).toContain("return false;");

    const result = compileSolidity("Checker", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================
// Console.log support
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
    expect(solidity).toContain(
      "uint256 a = ((first > second) ? second : first);"
    );
    expect(solidity).toContain(
      "uint256 b = ((first > second) ? first : second);"
    );
  });
});

// ============================================================
// Object destructuring
// ============================================================

describe("integration: object destructuring", () => {
  it("should compile const { a, b } = { a: 1, b: 2 } as separate declarations", () => {
    const { errors, solidity } = compileTS(`
      class Test {
        public getValues(): number {
          const { a, b, c } = { a: 7, b: 8, c: 9 };
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

  it("should compile object destructuring from a struct-returning method", () => {
    const { errors, solidity } = compileTS(`
      type StakeInfo = {
        amount: number;
        timestamp: number;
      };

      class Staking {
        private stakes: Record<address, StakeInfo> = {};

        public getStakeInfo(account: address): StakeInfo {
          return this.stakes[account];
        }

        public getAmount(account: address): number {
          const { amount, timestamp } = this.getStakeInfo(account);
          return amount;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "StakeInfo memory __sk_stakeInfo_0 = getStakeInfo(account);"
    );
    expect(solidity).toContain("uint256 amount = __sk_stakeInfo_0.amount;");
    expect(solidity).toContain(
      "uint256 timestamp = __sk_stakeInfo_0.timestamp;"
    );
  });

  it("should compile object destructuring with renaming", () => {
    const { errors, solidity } = compileTS(`
      class Test {
        public getValues(): number {
          const { a: x, b: y } = { a: 1, b: 2 };
          return x + y;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("uint256 x = 1;");
    expect(solidity).toContain("uint256 y = 2;");
  });
});

// ============================================================
// Tuple destructuring from function return values
// ============================================================

describe("integration: tuple destructuring", () => {
  it("should compile const [a, b] = this.getReserves() as tuple destructuring", () => {
    const { errors, solidity } = compileTS(`
      class Pair {
        private reserve0: number = 0;
        private reserve1: number = 0;

        getReserves(): [number, number] {
          return [this.reserve0, this.reserve1];
        }

        public getSum(): number {
          const [r0, r1] = this.getReserves();
          return r0 + r1;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("(uint256 r0, uint256 r1) = getReserves();");
    expect(solidity).toContain("return (r0 + r1);");
  });

  it("should compile tuple destructuring with mixed types", () => {
    const { errors, solidity } = compileTS(`
      class Test {
        private value: number = 0;
        private flag: boolean = false;

        getInfo(): [number, boolean] {
          return [this.value, this.flag];
        }

        public check(): number {
          const [v, f] = this.getInfo();
          if (f) {
            return v;
          }
          return 0;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("(uint256 v, bool f) = getInfo();");
  });

  it("should compile tuple destructuring with three return values", () => {
    const { errors, solidity } = compileTS(`
      class Pool {
        private reserve0: number = 0;
        private reserve1: number = 0;
        private totalSupply: number = 0;

        getState(): [number, number, number] {
          return [this.reserve0, this.reserve1, this.totalSupply];
        }

        public computeShare(): number {
          const [r0, r1, supply] = this.getState();
          return r0 + r1 + supply;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "(uint256 r0, uint256 r1, uint256 supply) = getState();"
    );
  });

  it("should compile tuple destructuring with skipped elements", () => {
    const { errors, solidity } = compileTS(`
      class Pair {
        private reserve0: number = 0;
        private reserve1: number = 0;

        getReserves(): [number, number] {
          return [this.reserve0, this.reserve1];
        }

        public getSecond(): number {
          const [, r1] = this.getReserves();
          return r1;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("(, uint256 r1) = getReserves();");
  });

  it("should error when tuple type cannot be resolved for call destructuring", () => {
    expect(() => {
      compileTS(`
        class Test {
          public doSomething(): number {
            const [a, b] = unknownFunc();
            return a + b;
          }
        }
      `);
    }).toThrow("Unable to resolve tuple return type");
  });

  it("should error when destructuring has more elements than tuple arity", () => {
    expect(() => {
      compileTS(`
        class Test {
          getTwo(): [number, number] {
            return [1, 2];
          }
          public doSomething(): number {
            const [a, b, c] = this.getTwo();
            return a + b + c;
          }
        }
      `);
    }).toThrow("more elements than the function's tuple return type");
  });

  it("should error on unsupported binding elements in tuple destructuring", () => {
    expect(() => {
      compileTS(`
        class Test {
          getTwo(): [number, number] {
            return [1, 2];
          }
          public doSomething(): number {
            const [a = 1, b] = this.getTwo();
            return a + b;
          }
        }
      `);
    }).toThrow("Unsupported tuple destructuring binding element");
  });

  it("should compile tuple destructuring with fewer bindings than elements", () => {
    const { errors, solidity } = compileTS(`
      class Pair {
        private reserve0: number = 0;
        private reserve1: number = 0;

        getReserves(): [number, number] {
          return [this.reserve0, this.reserve1];
        }

        public getFirst(): number {
          const [r0] = this.getReserves();
          return r0;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("(uint256 r0, ) = getReserves()");
  });
});

// ============================================================
// Cross file function imports
// ============================================================

