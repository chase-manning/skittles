import { describe, expect,it } from "vitest";

import {
  generateSolidity,
} from "../../src/compiler/codegen";
import {
  collectFunctions,
  collectTypes,
  parse,
} from "../../src/compiler/parser";
import { ctx } from "../../src/compiler/parser-context";
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
    expect(solidity).toContain(
      "function getOrigin() public pure virtual returns (Position memory)"
    );
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
// Unused shared definitions should be excluded
// ============================================================

describe("integration: unused shared definitions excluded", () => {
  it("should not include unused external structs in generated Solidity", () => {
    const typesSource = `
      type Position = { x: number; y: number; };
      type Velocity = { dx: number; dy: number; };
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
    const solidity = generateSolidity(contracts[0]);

    expect(solidity).toContain("struct Position {");
    expect(solidity).not.toContain("struct Velocity {");
  });

  it("should not include unused external enums in generated Solidity", () => {
    const typesSource = `
      enum Color { Red, Green, Blue }
      enum VaultStatus { Active, Paused, Closed }
    `;
    const contractSource = `
      class Palette {
        public color: Color;
      }
    `;

    const { structs, enums } = collectTypes(typesSource, "types.ts");
    const contracts = parse(contractSource, "palette.ts", { structs, enums });
    const solidity = generateSolidity(contracts[0]);

    expect(solidity).toContain("enum Color { Red, Green, Blue }");
    expect(solidity).not.toContain("VaultStatus");
  });

  it("should not include unused external file functions in generated Solidity", () => {
    const typesSource = `
      function calculateFee(amount: number): number {
        return amount / 100;
      }
      function double(x: number): number {
        return x * 2;
      }
    `;
    const contractSource = `
      class Counter {
        public count: number = 0;
        public increment(): void {
          this.count = this.count + 1;
        }
      }
    `;

    const { functions, constants } = collectFunctions(typesSource, "utils.ts");
    const { structs, enums } = collectTypes(typesSource, "utils.ts");
    const contracts = parse(
      contractSource,
      "counter.ts",
      { structs, enums },
      { functions, constants }
    );
    const solidity = generateSolidity(contracts[0]);

    expect(solidity).not.toContain("calculateFee");
    expect(solidity).not.toContain("double");
  });

  it("should include only the file functions that are actually called", () => {
    const utilsSource = `
      function calculateFee(amount: number): number {
        return amount / 100;
      }
      function double(x: number): number {
        return x * 2;
      }
    `;
    const contractSource = `
      class Vault {
        public fee: number = 0;
        public setFee(amount: number): void {
          this.fee = calculateFee(amount);
        }
      }
    `;

    const { functions, constants } = collectFunctions(utilsSource, "utils.ts");
    const { structs, enums } = collectTypes(utilsSource, "utils.ts");
    const contracts = parse(
      contractSource,
      "vault.ts",
      { structs, enums },
      { functions, constants }
    );
    const solidity = generateSolidity(contracts[0]);

    expect(solidity).toContain("function calculateFee(");
    expect(solidity).not.toContain("double");
  });

  it("should transitively include file functions called by used file functions", () => {
    const utilsSource = `
      function helper(x: number): number {
        return x + 1;
      }
      function compute(x: number): number {
        return helper(x) * 2;
      }
      function unused(x: number): number {
        return x;
      }
    `;
    const contractSource = `
      class Calculator {
        public result: number = 0;
        public run(x: number): void {
          this.result = compute(x);
        }
      }
    `;

    const { functions, constants } = collectFunctions(utilsSource, "utils.ts");
    const { structs, enums } = collectTypes(utilsSource, "utils.ts");
    const contracts = parse(
      contractSource,
      "calc.ts",
      { structs, enums },
      { functions, constants }
    );
    const solidity = generateSolidity(contracts[0]);

    expect(solidity).toContain("function compute(");
    expect(solidity).toContain("function helper(");
    expect(solidity).not.toContain("unused");
  });

  it("should transitively include structs referenced by used struct fields", () => {
    const typesSource = `
      type Inner = { value: number; };
      type Outer = { inner: Inner; label: string; };
      type Unrelated = { data: number; };
    `;
    const contractSource = `
      class Store {
        public get(): Outer {
          let o: Outer = { inner: { value: 0 }, label: "" };
          return o;
        }
      }
    `;

    const { structs, enums } = collectTypes(typesSource, "types.ts");
    const contracts = parse(contractSource, "store.ts", { structs, enums });
    const solidity = generateSolidity(contracts[0]);

    expect(solidity).toContain("struct Outer {");
    expect(solidity).toContain("struct Inner {");
    expect(solidity).not.toContain("Unrelated");
  });

  it("should include enums referenced via member access in expressions", () => {
    const typesSource = `
      enum Status { Active, Paused, Closed }
      enum Color { Red, Green, Blue }
    `;
    const contractSource = `
      class Contract {
        public status: Status = Status.Active;
      }
    `;

    const { structs, enums } = collectTypes(typesSource, "types.ts");
    const contracts = parse(contractSource, "contract.ts", { structs, enums });
    const solidity = generateSolidity(contracts[0]);

    expect(solidity).toContain("enum Status { Active, Paused, Closed }");
    expect(solidity).not.toContain("Color");
  });
});

// ============================================================
// Standalone / free functions
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
    const { functions, constants } = collectFunctions(
      librarySource,
      "library.ts"
    );

    const contracts = parse(
      contractSource,
      "calc.ts",
      { structs, enums },
      { functions, constants }
    );
    expect(contracts).toHaveLength(1);

    const solidity = generateSolidity(contracts[0]);
    const result = compileSolidity(contracts[0].name, solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
    expect(solidity).toContain(
      "function add(uint256 a, uint256 b) internal pure returns (uint256)"
    );
    expect(solidity).toContain(
      "function multiply(uint256 a, uint256 b) internal pure returns (uint256)"
    );
    expect(solidity).toContain("return add(x, y);");
    expect(solidity).toContain("return multiply(x, y);");
  });
});

// ============================================================
// Standalone functions referencing imported enum types
// ============================================================

describe("integration: cross file enum in standalone function parameter", () => {
  it("should not throw when collectFunctions parses a function with an imported enum parameter", () => {
    const typesSource = `
      enum VaultStatus { Active, Paused, Stopped }
    `;
    const functionSource = `
      function isActive(s: VaultStatus): boolean {
        return s == 0;
      }
    `;

    // Collect enum types from the types file first
    const { structs, enums } = collectTypes(typesSource, "types.ts");

    // Seed the parser context with the collected enums (simulating pre-scan)
    ctx.knownEnums = new Map(enums);
    ctx.knownStructs = new Map(structs);

    // collectFunctions should not throw for the imported enum type
    expect(() => {
      collectFunctions(functionSource, "utils.ts");
    }).not.toThrow();

    const { functions } = collectFunctions(functionSource, "utils.ts");
    expect(functions).toHaveLength(1);
    expect(functions[0].name).toBe("isActive");
  });
});

describe("integration: cross file enum in type guard function parameter", () => {
  it("should not throw when collectFunctions parses a type guard with an imported enum", () => {
    const typesSource = `
      enum VaultStatus { Active, Paused, Stopped }
    `;
    const functionSource = `
      function isActive(s: VaultStatus): s is VaultStatus {
        return s == 0;
      }
    `;

    // Collect enum types from the types file first
    const { structs, enums } = collectTypes(typesSource, "types.ts");

    // Seed the parser context with the collected enums (simulating pre-scan)
    ctx.knownEnums = new Map(enums);
    ctx.knownStructs = new Map(structs);

    // collectFunctions should not throw for the imported enum type in a type guard
    expect(() => {
      collectFunctions(functionSource, "utils.ts");
    }).not.toThrow();

    const { functions } = collectFunctions(functionSource, "utils.ts");
    expect(functions).toHaveLength(1);
    expect(functions[0].name).toBe("isActive");
    expect(functions[0].returnType).toEqual({ kind: "bool" });
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
    const { functions, constants } = collectFunctions(
      constantsSource,
      "constants.ts"
    );

    const contracts = parse(
      contractSource,
      "token.ts",
      { structs, enums },
      { functions, constants }
    );
    const solidity = generateSolidity(contracts[0]);
    const result = compileSolidity(contracts[0].name, solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
    expect(solidity).toContain("return 1000000;");
    expect(solidity).toContain(
      "return address(0x0000000000000000000000000000000000000000);"
    );
  });
});

// ============================================================
// implements keyword
// ============================================================

