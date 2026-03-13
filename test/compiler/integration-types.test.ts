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
    expect(solidity).toContain(
      'string public constant TOKEN_NAME = "MyToken";'
    );
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
    const contracts = parse(
      `
      class Test {
        public getSender(): address {
          const s: address = msg.sender;
          return s;
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("address s = msg.sender;");
  });
});

// ============================================================
// Void operator
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
    const contracts = parse(
      `
      class Checker {
        public isZero(x: number): boolean {
          return x == null as any;
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("(x == 0)");
  });
});

// ============================================================
// Delete expressions
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
    expect(solidity).toContain(
      "function isTrue() public pure virtual returns (bool)"
    );
    expect(solidity).toContain(
      "function isFalse() public pure virtual returns (bool)"
    );
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
    expect(solidity).toContain(
      "function check(bool a, bool b) public pure virtual returns (bool)"
    );

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

  it("should compile 'is' type guard functions as bool-returning helpers", () => {
    const { errors, solidity } = compileTS(`
      enum Status { Active, Paused, Stopped }

      function isActive(s: Status): s is Status.Active {
        return s == Status.Active;
      }

      export class Vault {
        status: Status;

        public doAction(): void {
          if (isActive(this.status)) {
            this.status = Status.Paused;
          }
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "function isActive(Status s) internal pure returns (bool)"
    );
  });

  it("should reject 'asserts' type predicates with a clear error", () => {
    expect(() =>
      compileTS(`
        function assertIsPositive(value: number): asserts value {
          if (value <= 0) {
            throw new Error("Not positive");
          }
        }

        export class Validator {
          public check(v: number): void {
            assertIsPositive(v);
          }
        }
      `)
    ).toThrow("Skittles does not support 'asserts' type predicates");
  });
});

// ============================================================
// virtual / override
// ============================================================

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

describe("integration: Map method support", () => {
  it("should compile map.delete(key) to delete mapping[key]", () => {
    const { errors, solidity } = compileTS(`
      class Registry {
        private data: Map<address, number> = {};

        public remove(addr: address): void {
          this.data.delete(addr);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("delete data[addr];");
  });

  it("should detect map.delete() as state mutation", () => {
    const contracts = parse(
      `
      class Registry {
        private data: Map<address, number> = {};

        public remove(addr: address): void {
          this.data.delete(addr);
        }
      }
    `,
      "test.ts"
    );
    expect(contracts[0].functions[0].stateMutability).toBe("nonpayable");
  });

  it("should compile map.set(key, value) to mapping[key] = value", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        private balances: Map<address, number> = {};

        public setBalance(addr: address, amount: number): void {
          this.balances.set(addr, amount);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("balances[addr] = amount;");
  });

  it("should detect map.set() as state mutation", () => {
    const contracts = parse(
      `
      class Token {
        private balances: Map<address, number> = {};

        public setBalance(addr: address, amount: number): void {
          this.balances.set(addr, amount);
        }
      }
    `,
      "test.ts"
    );
    expect(contracts[0].functions[0].stateMutability).toBe("nonpayable");
  });

  it("should compile map.get(key) to mapping[key]", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        private balances: Map<address, number> = {};

        public getBalance(addr: address): number {
          return this.balances.get(addr);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("return balances[addr];");
  });

  it("should detect map.get() as view", () => {
    const contracts = parse(
      `
      class Token {
        private balances: Map<address, number> = {};

        public getBalance(addr: address): number {
          return this.balances.get(addr);
        }
      }
    `,
      "test.ts"
    );
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });

  it("should compile map.has(key) to mapping[key] != 0", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        private balances: Map<address, number> = {};

        public hasBalance(addr: address): boolean {
          return this.balances.has(addr);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("return (balances[addr] != 0);");
  });

  it("should compile map.has(key) with boolean value to != false", () => {
    const { errors, solidity } = compileTS(`
      class Registry {
        private registered: Map<address, boolean> = {};

        public isRegistered(addr: address): boolean {
          return this.registered.has(addr);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("return (registered[addr] != false);");
  });

  it("should compile map.has(key) with address value to != address(0)", () => {
    const { errors, solidity } = compileTS(`
      class Registry {
        private owners: Map<number, address> = {};

        public hasOwner(id: number): boolean {
          return this.owners.has(id);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("return (owners[id] != address(0));");
  });

  it("should throw error for map.has() on unsupported value types", () => {
    expect(() =>
      compileTS(`
      class Registry {
        private names: Map<address, string> = {};

        public hasName(addr: address): boolean {
          return this.names.has(addr);
        }
      }
    `)
    ).toThrow("Map.has(key) is not supported for this mapping value type");
  });

  it("should detect map.has() as view", () => {
    const contracts = parse(
      `
      class Token {
        private balances: Map<address, number> = {};

        public hasBalance(addr: address): boolean {
          return this.balances.has(addr);
        }
      }
    `,
      "test.ts"
    );
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });

  it("should compile map.get() on nested mapping", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        private allowances: Map<address, Map<address, number>> = {};

        public getAllowance(owner: address, spender: address): number {
          return this.allowances[owner].get(spender);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("return allowances[owner][spender];");
  });

  it("should compile map.set() on nested mapping", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        private allowances: Map<address, Map<address, number>> = {};

        public setAllowance(owner: address, spender: address, amount: number): void {
          this.allowances[owner].set(spender, amount);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("allowances[owner][spender] = amount;");
  });

  it("should not transform .get() on non-mapping state variables", () => {
    const { errors, solidity } = compileTS(`
      class Registry {
        private items: number[] = [];

        public getFirst(): number {
          return this.items[0];
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("return items[0];");
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
    const contracts = parse(
      `
      class R {
        public items: number[] = [];
        public addItem(val: number): void {
          this.items.push(val);
        }
      }
    `,
      "test.ts"
    );
    expect(contracts[0].functions[0].stateMutability).toBe("nonpayable");
  });

  it("should detect array read as view", () => {
    const contracts = parse(
      `
      class R {
        public items: number[] = [];
        public getCount(): number {
          return this.items.length;
        }
      }
    `,
      "test.ts"
    );
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });
});

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
    const contracts = parse(
      `
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
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("Point memory p = Point(x, y);");
  });
});

// ============================================================
// Template literals
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
    const balancesGetter = (abi as any[]).find(
      (i: any) => i.name === "balances" && i.type === "function"
    );
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
    expect(solidity).toContain(
      "mapping(address => mapping(address => uint256)) public allowances;"
    );

    // Nested mapping getter takes two address args
    const getter = (abi as any[]).find(
      (i: any) => i.name === "allowances" && i.type === "function"
    );
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

describe("integration: type casting", () => {
  it("should pass through address() cast", () => {
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

  it("should handle angle bracket type assertions transparently", () => {
    const contracts = parse(
      `
      class Caster {
        public cast(x: number): number {
          return <number>x;
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("return x;");
  });
});

// ============================================================
// Custom errors
// ============================================================

