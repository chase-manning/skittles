import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect,it } from "vitest";

import {
  generateSolidity,
  generateSolidityFile,
} from "../../src/compiler/codegen";
import { compile } from "../../src/compiler/compiler";
import {
  collectFunctions,
  collectTypes,
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
    expect(solidity).toContain(
      "function getValue() public pure virtual returns (uint256)"
    );
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
    expect(solidity).toContain(
      "function getValue() public pure virtual returns (uint256)"
    );
    expect(solidity).toContain(
      "function getValue() public pure override returns (uint256)"
    );
  });
});

// ============================================================
// abstract contracts
// ============================================================

describe("integration: abstract contracts", () => {
  it("should compile an abstract class to an abstract contract", () => {
    const source = `
      abstract class Base {
        abstract getValue(): number;
      }

      class Child extends Base {
        public getValue(): number {
          return 42;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts).toHaveLength(2);
    expect(contracts[0].isAbstract).toBe(true);
    expect(contracts[0].functions[0].isAbstract).toBe(true);

    const solidity = generateSolidityFile(contracts);
    expect(solidity).toContain("abstract contract Base {");
    expect(solidity).toContain(
      "function getValue() public pure virtual returns (uint256);"
    );
    expect(solidity).toContain("contract Child is Base {");
    expect(solidity).toContain(
      "function getValue() public pure override returns (uint256)"
    );

    const result = compileSolidity("Child", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
    expect(result.bytecode.length).toBeGreaterThan(0);
  });

  it("should compile abstract class with mix of abstract and concrete methods", () => {
    const source = `
      abstract class Base {
        public value: number = 0;

        abstract getValue(): number;

        public increment(): void {
          this.value = this.value + 1;
        }
      }

      class Child extends Base {
        public getValue(): number {
          return this.value;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].isAbstract).toBe(true);

    const solidity = generateSolidityFile(contracts);
    expect(solidity).toContain("abstract contract Base {");
    expect(solidity).toContain(
      "function getValue() public view virtual returns (uint256);"
    );
    expect(solidity).toContain("function increment() public virtual {");

    const result = compileSolidity("Child", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should compile abstract class with constructor", () => {
    const source = `
      abstract class Ownable {
        public owner: address;

        constructor() {
          this.owner = msg.sender;
        }

        abstract getOwner(): address;
      }

      class Token extends Ownable {
        public getOwner(): address {
          return this.owner;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidityFile(contracts);
    expect(solidity).toContain("abstract contract Ownable {");
    expect(solidity).toContain("constructor()");
    expect(solidity).toContain(
      "function getOwner() public view virtual returns (address);"
    );

    const result = compileSolidity("Token", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
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

  it("should infer correct mutability for super.method() that modifies state", () => {
    const source = `
      abstract class BaseContract {
        public value: number = 0;

        abstract getValue(): number;

        public increment(): void {
          this.value = this.value + 1;
        }
      }

      class ChildContract extends BaseContract {
        getValue(): number {
          return this.value;
        }

        override increment(): void {
          this.value = this.value + 2;
        }

        public callSuper(): void {
          super.increment();
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidityFile(contracts);
    expect(solidity).toContain("super.increment()");
    expect(solidity).not.toMatch(/function callSuper\(\) public pure/);

    const result = compileSolidity("ChildContract", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
    expect(result.bytecode.length).toBeGreaterThan(0);
  });

  it("should infer correct mutability for cross-file super.method() calls", async () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "skittles-super-cross-file-")
    );
    try {
      fs.mkdirSync(path.join(tmpDir, "contracts"), { recursive: true });

      fs.writeFileSync(
        path.join(tmpDir, "contracts", "Base.ts"),
        `
        export class Base {
          public value: number = 0;

          public increment(): void {
            this.value = this.value + 1;
          }
        }
      `
      );

      fs.writeFileSync(
        path.join(tmpDir, "contracts", "Child.ts"),
        `
        export class Child extends Base {
          public override increment(): void {
            this.value = this.value + 2;
          }

          public callSuper(): void {
            super.increment();
          }
        }
      `
      );

      const result = await compile(tmpDir, defaultConfig);
      expect(result.success).toBe(true);

      const childArtifact = result.artifacts.find(
        (a) => a.contractName === "Child"
      );
      expect(childArtifact).toBeDefined();
      expect(childArtifact!.solidity).toContain("super.increment()");
      expect(childArtifact!.solidity).not.toMatch(
        /function callSuper\(\) public pure/
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ============================================================
// receive and fallback
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
    expect(solidity).toContain(
      "function balance(address account) external view returns (uint256);"
    );
    expect(solidity).toContain("contract Token is IToken {");
    expect(solidity).toContain(
      "function balance(address account) public view override"
    );
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

  it("should compile multiple interface implementations", () => {
    const source = `
      interface IOwnable {
        owner: address;
        transferOwnership(newOwner: address): void;
      }

      interface IPausable {
        paused: boolean;
        pause(): void;
        unpause(): void;
      }

      class MyContract implements IOwnable, IPausable {
        public owner: address = msg.sender;
        public paused: boolean = false;

        public transferOwnership(newOwner: address): void {
          this.owner = newOwner;
        }

        public pause(): void {
          this.paused = true;
        }

        public unpause(): void {
          this.paused = false;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts).toHaveLength(1);
    expect(contracts[0].name).toBe("MyContract");
    expect(contracts[0].inherits).toEqual(["IOwnable", "IPausable"]);
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("interface IOwnable {");
    expect(solidity).toContain("interface IPausable {");
    expect(solidity).toContain("contract MyContract is IOwnable, IPausable {");
    expect(solidity).toContain(
      "function transferOwnership(address newOwner) public override"
    );
    expect(solidity).toContain("function pause() public override");
    expect(solidity).toContain("function unpause() public override");
    expect(solidity).toContain("address public override owner");
    expect(solidity).toContain("bool public override paused");
    const result = compileSolidity("MyContract", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should compile extends with multiple implements", () => {
    const source = `
      interface IOwnable {
        owner: address;
        transferOwnership(newOwner: address): void;
      }

      interface IPausable {
        paused: boolean;
        pause(): void;
        unpause(): void;
      }

      class Base {
        public value: number = 0;

        public getValue(): number {
          return this.value;
        }
      }

      class MyContract extends Base implements IOwnable, IPausable {
        public owner: address = msg.sender;
        public paused: boolean = false;

        public transferOwnership(newOwner: address): void {
          this.owner = newOwner;
        }

        public pause(): void {
          this.paused = true;
        }

        public unpause(): void {
          this.paused = false;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts).toHaveLength(2);
    expect(contracts[1].name).toBe("MyContract");
    expect(contracts[1].inherits).toEqual(["Base", "IOwnable", "IPausable"]);
    const solidity = generateSolidityFile(contracts);
    expect(solidity).toContain(
      "contract MyContract is Base, IOwnable, IPausable {"
    );
    expect(solidity).toContain(
      "function transferOwnership(address newOwner) public override"
    );
    expect(solidity).toContain("function pause() public override");
    const result = compileSolidity("MyContract", solidity, defaultConfig);
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
    expect(solidity).toContain(
      "function name() external view returns (string memory);"
    );
    expect(solidity).toContain(
      "function balanceOf(address account) external view returns (uint256);"
    );
    expect(solidity).toContain(
      "function transfer(address to, uint256 amount) external returns (bool);"
    );
    expect(solidity).toContain("contract Token is IToken {");
    // Implementing functions should have override, not virtual
    expect(solidity).toContain("function name() public view override");
    expect(solidity).toContain(
      "function transfer(address to, uint256 amount) public override"
    );
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
    expect(solidity).toContain(
      "function owner() external view returns (address);"
    );
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
    expect(solidity).toContain(
      "function name() external view returns (string memory);"
    );
    expect(solidity).toContain(
      "function symbol() external view returns (string memory);"
    );
    expect(solidity).toContain(
      "function totalSupply() external view returns (uint256);"
    );
    // Method mutability derived from implementation
    expect(solidity).toContain(
      "function balanceOf(address account) external view returns (uint256);"
    );
    expect(solidity).toContain(
      "function transfer(address to, uint256 amount) external returns (bool);"
    );
    expect(solidity).toContain("contract Token is IToken {");
    // Public variables get override
    expect(solidity).toContain('string public override name = "MyToken"');
    expect(solidity).toContain('string public override symbol = "MTK"');
    expect(solidity).toContain("uint256 public override totalSupply = 1000");
    // Functions get override
    expect(solidity).toContain(
      "function balanceOf(address account) public view override"
    );
    expect(solidity).toContain(
      "function transfer(address to, uint256 amount) public override"
    );
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
    expect(solidity).toContain(
      "function greet() external pure returns (string memory);"
    );
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
    expect(solidity).toContain(
      "function set(uint256 key, uint256 value) external;"
    );
    expect(solidity).toContain(
      "function set(uint256 key, uint256 value) public override"
    );
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

    const { structs, enums, contractInterfaces } = collectTypes(
      typesSource,
      "types.ts"
    );
    const contracts = parse(contractSource, "counter.ts", {
      structs,
      enums,
      contractInterfaces,
    });
    expect(contracts).toHaveLength(1);
    expect(contracts[0].inherits).toEqual(["ICounter"]);

    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("interface ICounter {");
    expect(solidity).toContain("function increment() external;");
    expect(solidity).toContain(
      "function getCount() external view returns (uint256);"
    );
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
    expect(solidity).toContain(
      "function register(string calldata name) external;"
    );
    expect(solidity).toContain(
      "function lookup(string calldata name) external view returns (address);"
    );
    const result = compileSolidity("Registry", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================
// Type alias structs
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

    expect(solidity).toContain(
      "function getTokenInfo(address token) external view returns (TokenInfo memory);"
    );
    expect(solidity).toContain(
      "function register(TokenInfo calldata info) external;"
    );

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

// ============================================================
// Cross-file interface bugs
// ============================================================

describe("integration: cross-file contract interface usage", () => {
  const tokenSource = `
    interface IToken {
      name: string;
      symbol: string;
      totalSupply: number;
      balanceOf(account: address): number;
      transfer(to: address, amount: number): boolean;
      transferFrom(from: address, to: address, amount: number): boolean;
      approve(spender: address, amount: number): boolean;
      allowance(owner: address, spender: address): number;
    }

    class Token implements IToken {
      public name: string = "MyToken";
      public symbol: string = "MTK";
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

      public approve(spender: address, amount: number): boolean {
        this.allowances[msg.sender][spender] = amount;
        return true;
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

      public transferFrom(from: address, to: address, amount: number): boolean {
        const sender: address = msg.sender;
        if (this.balances[from] < amount) {
          throw new Error("Insufficient balance");
        }
        if (this.allowances[from][sender] < amount) {
          throw new Error("Insufficient allowance");
        }
        this.balances[from] -= amount;
        this.balances[to] += amount;
        this.allowances[from][sender] -= amount;
        return true;
      }
    }
  `;

  const dexSource = `
    class Dex {
      public token: IToken;

      constructor(token_: IToken) {
        this.token = token_;
      }

      public deposit(amount: number): void {
        this.token.transferFrom(msg.sender, self, amount);
      }
    }
  `;

  function compileCrossFile() {
    const { structs, enums, contractInterfaces } = collectTypes(
      tokenSource,
      "Token.ts"
    );
    const { functions, constants } = collectFunctions(tokenSource, "Token.ts");

    const tokenContracts = parse(
      tokenSource,
      "Token.ts",
      { structs, enums, contractInterfaces },
      { functions, constants }
    );
    const tokenSolidity = generateSolidity(tokenContracts[0]);

    const dexContracts = parse(
      dexSource,
      "Dex.ts",
      { structs, enums, contractInterfaces },
      { functions, constants }
    );

    // Resolve interface mutabilities from Token's implementation
    for (const contract of tokenContracts) {
      for (const iface of contract.contractInterfaces) {
        const globalIface = contractInterfaces.get(iface.name);
        if (!globalIface) continue;
        for (const fn of iface.functions) {
          if (!fn.stateMutability) continue;
          const globalFn = globalIface.functions.find(
            (f) => f.name === fn.name
          );
          if (globalFn && !globalFn.stateMutability) {
            globalFn.stateMutability = fn.stateMutability;
          }
        }
      }
    }

    // IToken is defined in Token.ts which also has contracts, so it should be imported
    for (const contract of dexContracts) {
      contract.contractInterfaces = contract.contractInterfaces.filter(
        (iface) => iface.name !== "IToken"
      );
    }
    const dexSolidity = generateSolidity(dexContracts[0], ["./Token.sol"]);

    return { tokenSolidity, dexSolidity, tokenContracts, dexContracts };
  }

  it("should not redeclare interface that is defined in another file", () => {
    const { dexSolidity } = compileCrossFile();

    // Dex.sol should import the interface from Token.sol, not redeclare it
    expect(dexSolidity).toContain("import");
    expect(dexSolidity).not.toContain("interface IToken {");
  });

  it("should have correct view modifiers on interface methods when used cross-file", () => {
    const { tokenSolidity, dexSolidity } = compileCrossFile();

    // Token.sol should have balanceOf and allowance as view
    expect(tokenSolidity).toContain(
      "function balanceOf(address account) external view returns (uint256);"
    );
    expect(tokenSolidity).toContain(
      "function allowance(address owner, address spender) external view returns (uint256);"
    );

    // If IToken appears in Dex.sol, it must also have view on balanceOf and allowance
    if (dexSolidity.includes("interface IToken")) {
      expect(dexSolidity).toContain(
        "function balanceOf(address account) external view returns (uint256);"
      );
      expect(dexSolidity).toContain(
        "function allowance(address owner, address spender) external view returns (uint256);"
      );
    }
  });

  it("should not mark deposit as view when it calls external contract method", () => {
    const { dexSolidity } = compileCrossFile();

    // deposit() calls token.transferFrom() which modifies state,
    // so deposit should NOT be view
    expect(dexSolidity).not.toContain(
      "function deposit(uint256 amount) public view"
    );
    // It should be nonpayable (no mutability keyword)
    expect(dexSolidity).toMatch(/function deposit\(uint256 amount\) public\b/);
  });

  it("should generate valid Solidity that compiles when files reference each other", () => {
    const { tokenSolidity, dexSolidity } = compileCrossFile();

    // Token.sol should compile on its own
    const tokenResult = compileSolidity("Token", tokenSolidity, defaultConfig);
    expect(tokenResult.errors).toHaveLength(0);

    // Dex.sol should have correct import and structure
    expect(dexSolidity).toContain('import "./Token.sol"');
    expect(dexSolidity).toContain("contract Dex {");
    expect(dexSolidity).toContain("IToken public token");
    expect(dexSolidity).toContain(
      "token.transferFrom(msg.sender, address(this), amount)"
    );
  });
});

// ============================================================
// Try/catch for external calls
// ============================================================

describe("integration: same-file inheritance deduplication", () => {
  it("should not duplicate shared enums in parent and child contracts", () => {
    const source = `
      enum Status { Active, Inactive }

      class Parent {
        public status: Status = Status.Active;

        public getStatus(): Status {
          return this.status;
        }
      }

      class Child extends Parent {
        public setStatus(s: Status): void {
          this.status = s;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidityFile(contracts);
    const result = compileSolidity("Child", solidity, defaultConfig);

    expect(result.errors).toHaveLength(0);
    // Enum should appear exactly once across the whole file
    const enumCount = (solidity.match(/enum Status/g) ?? []).length;
    expect(enumCount).toBe(1);
  });

  it("should not duplicate shared structs in parent and child contracts", () => {
    const source = `
      type Order = { amount: number; price: number };

      class Parent {
        public orders: Order[] = [];

        public addOrder(o: Order): void {
          this.orders.push(o);
        }
      }

      class Child extends Parent {
        public getOrder(index: number): Order {
          return this.orders[index];
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidityFile(contracts);
    const result = compileSolidity("Child", solidity, defaultConfig);

    expect(result.errors).toHaveLength(0);
    // Struct should appear exactly once across the whole file
    const structCount = (solidity.match(/struct Order/g) ?? []).length;
    expect(structCount).toBe(1);
  });

  it("should not duplicate shared file-level functions in parent and child contracts", () => {
    const source = `
      function helper(x: number): number {
        return x + 1;
      }

      class Parent {
        public value: number = 0;

        public increment(): void {
          this.value = helper(this.value);
        }
      }

      class Child extends Parent {
        public doubleIncrement(): void {
          this.value = helper(helper(this.value));
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidityFile(contracts);
    const result = compileSolidity("Child", solidity, defaultConfig);

    expect(result.errors).toHaveLength(0);
    // helper() should appear exactly once (in the parent contract body)
    const helperCount = (solidity.match(/function helper\(/g) ?? []).length;
    expect(helperCount).toBe(1);
  });

  it("should not duplicate custom errors in parent and child contracts", () => {
    const source = `
      class InsufficientBalance extends Error {
        constructor(needed: number, available: number) {
          super("");
        }
      }

      class Parent {
        public balance: number = 0;

        public withdraw(amount: number): void {
          if (this.balance < amount) {
            throw new InsufficientBalance(amount, this.balance);
          }
          this.balance -= amount;
        }
      }

      class Child extends Parent {
        public withdrawAll(): void {
          if (this.balance === 0) {
            throw new InsufficientBalance(1, 0);
          }
          this.balance = 0;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidityFile(contracts);
    const result = compileSolidity("Child", solidity, defaultConfig);

    expect(result.errors).toHaveLength(0);
    // Custom error should appear exactly once across the whole file
    const errorCount = (solidity.match(/error InsufficientBalance/g) ?? [])
      .length;
    expect(errorCount).toBe(1);
  });

  it("should still emit override functions in child contracts", () => {
    const source = `
      class Parent {
        public getValue(): number {
          return 1;
        }
      }

      class Child extends Parent {
        public override getValue(): number {
          return 2;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidityFile(contracts);
    const result = compileSolidity("Child", solidity, defaultConfig);

    expect(result.errors).toHaveLength(0);
    // getValue should appear in both parent (virtual) and child (override)
    expect(solidity).toContain(
      "function getValue() public pure virtual returns (uint256)"
    );
    expect(solidity).toContain(
      "function getValue() public pure override returns (uint256)"
    );
  });

  it("should emit shared definitions in both unrelated contracts in the same file", () => {
    const source = `
      enum Status { Active, Inactive }

      function helper(x: number): number {
        return x + 1;
      }

      class ContractA {
        public status: Status = Status.Active;

        public run(): number {
          return helper(1);
        }
      }

      class ContractB {
        public status: Status = Status.Inactive;

        public exec(): number {
          return helper(2);
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidityFile(contracts);

    // Both unrelated contracts should have the enum and helper function
    const enumCount = (solidity.match(/enum Status/g) ?? []).length;
    expect(enumCount).toBe(2);
    const helperCount = (solidity.match(/function helper\(/g) ?? []).length;
    expect(helperCount).toBe(2);

    // Both should compile successfully
    const resultA = compileSolidity("ContractA", solidity, defaultConfig);
    expect(resultA.errors).toHaveLength(0);
    const resultB = compileSolidity("ContractB", solidity, defaultConfig);
    expect(resultB.errors).toHaveLength(0);
  });

  it("should handle Parent, Unrelated, then Child extends Parent ordering", () => {
    const source = `
      enum Status { Active, Inactive }

      function helper(x: number): number {
        return x + 1;
      }

      class Parent {
        public status: Status = Status.Active;

        public run(): number {
          return helper(1);
        }
      }

      class Unrelated {
        public status: Status = Status.Inactive;

        public exec(): number {
          return helper(2);
        }
      }

      class Child extends Parent {
        public childRun(): number {
          return helper(3);
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidityFile(contracts);

    // Enum: Parent and Unrelated each get their own; Child inherits from Parent
    const enumCount = (solidity.match(/enum Status/g) ?? []).length;
    expect(enumCount).toBe(2);

    // helper(): Parent and Unrelated each get their own; Child inherits from Parent
    const helperCount = (solidity.match(/function helper\(/g) ?? []).length;
    expect(helperCount).toBe(2);

    // All three should compile successfully
    const resultParent = compileSolidity("Parent", solidity, defaultConfig);
    expect(resultParent.errors).toHaveLength(0);
    const resultUnrelated = compileSolidity(
      "Unrelated",
      solidity,
      defaultConfig
    );
    expect(resultUnrelated.errors).toHaveLength(0);
    const resultChild = compileSolidity("Child", solidity, defaultConfig);
    expect(resultChild.errors).toHaveLength(0);
  });
});

describe("integration: cross-file contract inheritance", () => {
  function createTempProject() {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "skittles-inherit-test-")
    );
    fs.mkdirSync(path.join(tmpDir, "contracts"), { recursive: true });
    return tmpDir;
  }

  function writeContract(
    projectRoot: string,
    fileName: string,
    source: string
  ) {
    fs.writeFileSync(
      path.join(projectRoot, "contracts", fileName),
      source,
      "utf-8"
    );
  }

  it("should generate import statement for parent contract from another file", async () => {
    const projectRoot = createTempProject();
    try {
      writeContract(
        projectRoot,
        "BaseToken.ts",
        `
        class BaseToken {
          public totalSupply: number = 0;
          protected balances: Record<address, number> = {};
          public balanceOf(account: address): number {
            return this.balances[account];
          }
        }
      `
      );
      writeContract(
        projectRoot,
        "ChildToken.ts",
        `
        class ChildToken extends BaseToken {
          public mint(to: address, amount: number): void {
            this.balances[to] += amount;
            this.totalSupply += amount;
          }
        }
      `
      );

      const result = await compile(projectRoot, defaultConfig);
      expect(result.success).toBe(true);

      const childArtifact = result.artifacts.find(
        (a) => a.contractName === "ChildToken"
      );
      expect(childArtifact).toBeDefined();
      expect(childArtifact!.solidity).toContain('import "./BaseToken.sol";');
      expect(childArtifact!.solidity).toContain(
        "contract ChildToken is BaseToken {"
      );
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("should compile parent contract successfully", () => {
    const baseTokenSource = `
      class BaseToken {
        public totalSupply: number = 0;
        protected balances: Record<address, number> = {};
        public balanceOf(account: address): number {
          return this.balances[account];
        }
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      baseTokenSource,
      "BaseToken.ts"
    );
    const { functions, constants } = collectFunctions(
      baseTokenSource,
      "BaseToken.ts"
    );
    const baseContracts = parse(
      baseTokenSource,
      "BaseToken.ts",
      { structs, enums, contractInterfaces },
      { functions, constants }
    );
    const baseSolidity = generateSolidity(baseContracts[0]);
    const result = compileSolidity("BaseToken", baseSolidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================
// Function overloading
// ============================================================

