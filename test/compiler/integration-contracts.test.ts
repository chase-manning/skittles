import { describe, it, expect } from "vitest";
import {
  parse,
  collectTypes,
  collectFunctions,
} from "../../src/compiler/parser";
import {
  generateSolidity,
  generateSolidityFile,
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

describe("integration: empty contract", () => {
  it("should compile an empty contract", () => {
    const { solidity, errors, bytecode } = compileTS("export class Empty {}");
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("contract Empty {");
    expect(bytecode.length).toBeGreaterThan(0);
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
    expect(solidity).toContain(
      "function balanceOf(address account) public view virtual returns (uint256)"
    );
    expect(solidity).toContain(
      "function transfer(address to, uint256 amount) public virtual returns (bool)"
    );
    expect(solidity).toContain(
      'require((balances[sender] >= amount), "Insufficient balance")'
    );
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
    expect(solidity).toContain(
      "function max(uint256 a, uint256 b) public pure virtual returns (uint256)"
    );
  });

  it("should compile ternary expressions in state variable initializers", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        public decimals: number = 18;
        public adjustedDecimals: number = this.decimals > 10 ? 18 : 8;
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("uint256 public decimals = 18;");
    expect(solidity).toContain(
      "uint256 public adjustedDecimals = ((decimals > 10) ? 18 : 8);"
    );
  });

  it("should compile void ternary expressions as if/else", () => {
    const { errors, solidity } = compileTS(`
      class VoidTernary {
        public a: number = 0;
        public b: number = 0;
        private doA(): void {
          this.a = 1;
        }
        private doB(): void {
          this.b = 1;
        }
        public run(condition: boolean): void {
          condition ? this.doA() : this.doB();
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toMatch(
      /if\s*\(\s*condition\s*\)\s*\{\s*doA\(\);\s*\}\s*else\s*\{\s*doB\(\);\s*\}/
    );
    expect(solidity).not.toMatch(/\?\s*doA\(\)/);
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
    expect(solidity).toContain(
      "function _transfer(address from, address to, uint256 amount) internal virtual {"
    );
    expect(solidity).toContain(
      "function transfer(address to, uint256 amount) public virtual {"
    );
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
    expect(solidity).toContain(
      "event Transfer(address from, address to, uint256 value);"
    );
    expect(solidity).toContain(
      "event Approval(address owner, address spender, uint256 value);"
    );

    // Verify nested mapping
    expect(solidity).toContain(
      "mapping(address => mapping(address => uint256)) internal allowances;"
    );

    // Verify all ERC20 functions
    expect(solidity).toContain(
      "function transfer(address to, uint256 amount) public virtual returns (bool)"
    );
    expect(solidity).toContain(
      "function approve(address spender, uint256 amount) public virtual returns (bool)"
    );
    expect(solidity).toContain(
      "function transferFrom(address from, address to, uint256 amount) public virtual returns (bool)"
    );
    expect(solidity).toContain(
      "function balanceOf(address account) public view virtual returns (uint256)"
    );
    expect(solidity).toContain(
      "function allowance(address owner, address spender) public view virtual returns (uint256)"
    );

    // Verify emit statements
    expect(solidity).toContain("emit Transfer(sender, to, amount);");
    expect(solidity).toContain("emit Approval(msg.sender, spender, amount);");
    expect(solidity).toContain("emit Transfer(from, to, amount);");

    // Verify require patterns
    expect(solidity).toContain(
      'require((balances[sender] >= amount), "ERC20: transfer amount exceeds balance");'
    );
    expect(solidity).toContain(
      'require((allowances[from][spender] >= amount), "ERC20: insufficient allowance");'
    );

    // Verify ABI
    const abiNames = abi as { name?: string; type?: string }[];
    const fnNames = abiNames.filter((i) => i.name).map((i) => i.name);
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
    const eventNames = abiNames
      .filter((i) => i.type === "event")
      .map((i) => i.name);
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
    expect(ownable.variables.find((v) => v.name === "owner")!.immutable).toBe(
      true
    );

    const token = contracts[1];
    expect(token.name).toBe("AdvancedToken");
    expect(token.inherits).toEqual(["Ownable"]);
    expect(token.events).toHaveLength(2);

    // Verify mutability propagation: transfer calls _transfer which mutates state
    const _transfer = token.functions.find((f) => f.name === "_transfer");
    const transfer = token.functions.find((f) => f.name === "transfer");
    const transferFrom = token.functions.find((f) => f.name === "transferFrom");
    const balanceOf = token.functions.find((f) => f.name === "balanceOf");
    const maxFn = token.functions.find((f) => f.name === "max");

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

    expect(solidity).toContain(
      "event Transfer(address from, address to, uint256 value);"
    );
    expect(solidity).toContain(
      "event Approval(address owner, address spender, uint256 value);"
    );

    expect(solidity).toContain("uint256 public immutable decimals = 18;");
    expect(solidity).toContain("address[] public holders;");
    expect(solidity).toContain(
      "mapping(address => mapping(address => uint256)) internal allowances;"
    );

    // Cross-function propagation: transfer must not be view
    expect(solidity).toContain(
      "function _transfer(address from, address to, uint256 amount) internal virtual {"
    );
    expect(solidity).toContain(
      "function transfer(address to, uint256 amount) public virtual returns (bool)"
    );
    expect(solidity).not.toMatch(/function transfer\(.*\) public view/);

    // Number.MAX_VALUE
    expect(solidity).toContain("type(uint256).max");

    // Ternary
    expect(solidity).toContain(
      "function max(uint256 a, uint256 b) public pure virtual returns (uint256)"
    );

    // Array operations
    expect(solidity).toContain("holders.push(msg.sender);");
    expect(solidity).toContain("return holders.length;");

    // Verify ABI completeness
    const abiNames = result.abi as { name?: string; type?: string }[];
    const fnNames = abiNames.filter((i) => i.name).map((i) => i.name);
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

    const eventNamesABI = abiNames
      .filter((i) => i.type === "event")
      .map((i) => i.name);
    expect(eventNamesABI).toContain("Transfer");
    expect(eventNamesABI).toContain("Approval");
  });
});

// ============================================================
// Bitwise operators
// ============================================================

describe("integration: external contract calls", () => {
  it("should compile a contract with an interface-typed state variable", () => {
    const interfaceSrc = `
      interface IToken {
        balanceOf(account: address): number;
        transfer(to: address, amount: number): boolean;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    const contractSrc = `
      class Vault {
        private token: IToken;

        constructor(tokenAddress: address) {
          this.token = Contract<IToken>(tokenAddress);
        }

        public getBalance(account: address): number {
          return this.token.balanceOf(account);
        }
      }
    `;

    const contracts = parse(contractSrc, "Vault.ts", externalTypes);
    expect(contracts).toHaveLength(1);

    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("interface IToken {");
    expect(solidity).toContain("IToken internal token;");
    expect(solidity).toContain("token = IToken(tokenAddress);");
    expect(solidity).toContain("return token.balanceOf(account);");

    const result = compileSolidity("Vault", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
    expect(result.bytecode.length).toBeGreaterThan(0);
  });

  it("should compile external contract calls on state variables", () => {
    const interfaceSrc = `
      interface IToken {
        transfer(to: address, amount: number): boolean;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    const contractSrc = `
      class Vault {
        private token: IToken;

        constructor(tokenAddress: address) {
          this.token = Contract<IToken>(tokenAddress);
        }

        public withdraw(to: address, amount: number): void {
          this.token.transfer(to, amount);
        }
      }
    `;

    const contracts = parse(contractSrc, "Vault.ts", externalTypes);
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("token.transfer(to, amount);");

    const result = compileSolidity("Vault", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect external contract calls as state-mutating", () => {
    const interfaceSrc = `
      interface IToken {
        transfer(to: address, amount: number): boolean;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    const contractSrc = `
      class Vault {
        private token: IToken;

        constructor(tokenAddress: address) {
          this.token = Contract<IToken>(tokenAddress);
        }

        public withdraw(to: address, amount: number): void {
          this.token.transfer(to, amount);
        }
      }
    `;

    const contracts = parse(contractSrc, "Vault.ts", externalTypes);
    const withdrawFn = contracts[0].functions.find(
      (f) => f.name === "withdraw"
    );
    expect(withdrawFn).toBeDefined();
    expect(withdrawFn!.stateMutability).toBe("nonpayable");
  });

  it("should compile external contract call with local variable of interface type", () => {
    const interfaceSrc = `
      interface IToken {
        balanceOf(account: address): number;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    const contractSrc = `
      class Checker {
        public checkBalance(tokenAddress: address, account: address): number {
          let token: IToken = Contract<IToken>(tokenAddress);
          return token.balanceOf(account);
        }
      }
    `;

    const contracts = parse(contractSrc, "Checker.ts", externalTypes);
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("interface IToken {");
    expect(solidity).toContain("IToken token = IToken(tokenAddress);");
    expect(solidity).toContain("return token.balanceOf(account);");

    const result = compileSolidity("Checker", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should include interface type used as function parameter", () => {
    const interfaceSrc = `
      interface IToken {
        balanceOf(account: address): number;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    const contractSrc = `
      class Helper {
        public getBalance(token: IToken, account: address): number {
          return token.balanceOf(account);
        }
      }
    `;

    const contracts = parse(contractSrc, "Helper.ts", externalTypes);
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("interface IToken {");
    expect(solidity).toContain(
      "function getBalance(IToken token, address account)"
    );

    const result = compileSolidity("Helper", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should not infer view on unannotated interface methods from usage patterns", () => {
    const interfaceSrc = `
      interface IExternalToken {
        balanceOf(account: address): number;
        transfer(to: address, amount: number): boolean;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IExternalToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    const contractSrc = `
      class VaultWithExternal {
        private token: IExternalToken;

        constructor(tokenAddress: address) {
          this.token = Contract<IExternalToken>(tokenAddress);
        }

        public getTokenBalance(account: address): number {
          return this.token.balanceOf(account);
        }
      }
    `;

    const contracts = parse(contractSrc, "Vault.ts", externalTypes);
    const solidity = generateSolidity(contracts[0]);

    // Unannotated interface methods remain without view/pure (conservative)
    expect(solidity).toContain(
      "function balanceOf(address account) external returns (uint256);"
    );
    expect(solidity).toContain(
      "function transfer(address to, uint256 amount) external returns (bool);"
    );

    const result = compileSolidity(
      "VaultWithExternal",
      solidity,
      defaultConfig
    );
    expect(result.errors).toHaveLength(0);
  });

  it("should not mark interface methods as view when used in state-modifying context", () => {
    const interfaceSrc = `
      interface IToken {
        transfer(to: address, amount: number): boolean;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    const contractSrc = `
      class Vault {
        private token: IToken;
        private lastSender: address;

        constructor(tokenAddress: address) {
          this.token = Contract<IToken>(tokenAddress);
        }

        public withdraw(to: address, amount: number): void {
          this.lastSender = msg.sender;
          this.token.transfer(to, amount);
        }
      }
    `;

    const contracts = parse(contractSrc, "Vault.ts", externalTypes);
    const withdrawFn = contracts[0].functions.find(
      (f) => f.name === "withdraw"
    );
    expect(withdrawFn).toBeDefined();
    expect(withdrawFn!.stateMutability).toBe("nonpayable");

    // transfer should not be marked as view since it's used in a state-modifying context
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).not.toContain(
      "function transfer(address to, uint256 amount) external view"
    );
    // withdraw should not be marked as view
    expect(solidity).not.toMatch(/function withdraw\(.*\) public view/);
  });

  it("should not incorrectly infer view for state-changing methods that return a value", () => {
    const interfaceSrc = `
      interface IToken {
        transfer(to: address, amount: number): boolean;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    const contractSrc = `
      class Vault {
        private token: IToken;

        constructor(tokenAddress: address) {
          this.token = Contract<IToken>(tokenAddress);
        }

        public doTransfer(to: address, amount: number): boolean {
          return this.token.transfer(to, amount);
        }
      }
    `;

    const contracts = parse(contractSrc, "Vault.ts", externalTypes);
    const doTransferFn = contracts[0].functions.find(
      (f) => f.name === "doTransfer"
    );
    expect(doTransferFn).toBeDefined();
    // transfer is not annotated as view, so doTransfer should be nonpayable (conservative)
    expect(doTransferFn!.stateMutability).toBe("nonpayable");

    const solidity = generateSolidity(contracts[0]);
    // transfer should not be marked as view
    expect(solidity).not.toContain(
      "function transfer(address to, uint256 amount) external view"
    );
    // doTransfer should not be marked as view
    expect(solidity).not.toMatch(/function doTransfer\(.*\) public view/);
  });

  it("should propagate already-known view mutability from interface to caller", () => {
    const interfaceSrc = `
      interface IToken {
        name: string;
        balanceOf(account: address): number;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    // name is a property signature, which is parsed as view by default
    const nameMethod = contractInterfaces
      .get("IToken")!
      .functions.find((f) => f.name === "name");
    expect(nameMethod?.stateMutability).toBe("view");

    const contractSrc = `
      class Reader {
        private token: IToken;

        constructor(tokenAddress: address) {
          this.token = Contract<IToken>(tokenAddress);
        }

        public getTokenName(): string {
          return this.token.name();
        }
      }
    `;

    const contracts = parse(contractSrc, "Reader.ts", externalTypes);
    const getTokenNameFn = contracts[0].functions.find(
      (f) => f.name === "getTokenName"
    );
    expect(getTokenNameFn).toBeDefined();
    // name is already view (property signature), so getTokenName should be view
    expect(getTokenNameFn!.stateMutability).toBe("view");

    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain(
      "function name() external view returns (string memory);"
    );
    expect(solidity).toMatch(/function getTokenName\(\) public view\b/);

    const result = compileSolidity("Reader", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should treat external calls to unannotated methods conservatively", () => {
    const interfaceSrc = `
      interface IToken {
        balanceOf(account: address): number;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    const contractSrc = `
      class Checker {
        public checkBalance(tokenAddress: address, account: address): number {
          let token: IToken = Contract<IToken>(tokenAddress);
          return token.balanceOf(account);
        }
      }
    `;

    const contracts = parse(contractSrc, "Checker.ts", externalTypes);
    const checkBalanceFn = contracts[0].functions.find(
      (f) => f.name === "checkBalance"
    );
    expect(checkBalanceFn).toBeDefined();
    // balanceOf is unannotated, so checkBalance should be nonpayable (conservative)
    expect(checkBalanceFn!.stateMutability).toBe("nonpayable");

    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain(
      "function balanceOf(address account) external returns (uint256);"
    );

    const result = compileSolidity("Checker", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should compile interface property access as getter call on state variable", () => {
    const interfaceSrc = `
      interface IToken {
        name: string;
        totalSupply: number;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    const contractSrc = `
      class Vault {
        private token: IToken;

        constructor(tokenAddr: address) {
          this.token = Contract<IToken>(tokenAddr);
        }

        public getTokenName(): string {
          return this.token.name;
        }

        public getSupply(): number {
          return this.token.totalSupply;
        }
      }
    `;

    const contracts = parse(contractSrc, "Vault.ts", externalTypes);
    const solidity = generateSolidity(contracts[0]);

    // Property access should be compiled to function calls
    expect(solidity).toContain("return token.name();");
    expect(solidity).toContain("return token.totalSupply();");

    // Interface should have view getters
    expect(solidity).toContain(
      "function name() external view returns (string memory);"
    );
    expect(solidity).toContain(
      "function totalSupply() external view returns (uint256);"
    );

    // Functions should be inferred as view
    const getTokenNameFn = contracts[0].functions.find(
      (f) => f.name === "getTokenName"
    );
    expect(getTokenNameFn).toBeDefined();
    expect(getTokenNameFn!.stateMutability).toBe("view");

    const getSupplyFn = contracts[0].functions.find(
      (f) => f.name === "getSupply"
    );
    expect(getSupplyFn).toBeDefined();
    expect(getSupplyFn!.stateMutability).toBe("view");

    const result = compileSolidity("Vault", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should compile interface property access as getter call on local variable", () => {
    const interfaceSrc = `
      interface IToken {
        name: string;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    const contractSrc = `
      class Reader {
        public readName(tokenAddr: address): string {
          let token: IToken = Contract<IToken>(tokenAddr);
          return token.name;
        }
      }
    `;

    const contracts = parse(contractSrc, "Reader.ts", externalTypes);
    const solidity = generateSolidity(contracts[0]);

    expect(solidity).toContain("return token.name();");

    const readNameFn = contracts[0].functions.find(
      (f) => f.name === "readName"
    );
    expect(readNameFn).toBeDefined();
    expect(readNameFn!.stateMutability).toBe("view");

    const result = compileSolidity("Reader", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should not transform property access when already used as method call", () => {
    const interfaceSrc = `
      interface IToken {
        name: string;
        balanceOf(account: address): number;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    const contractSrc = `
      class Reader {
        private token: IToken;

        constructor(tokenAddr: address) {
          this.token = Contract<IToken>(tokenAddr);
        }

        public getTokenName(): string {
          return this.token.name();
        }

        public getBalance(account: address): number {
          return this.token.balanceOf(account);
        }
      }
    `;

    const contracts = parse(contractSrc, "Reader.ts", externalTypes);
    const solidity = generateSolidity(contracts[0]);

    // Method call syntax should still work (no double parentheses)
    expect(solidity).toContain("return token.name();");
    expect(solidity).toContain("return token.balanceOf(account);");

    const result = compileSolidity("Reader", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should compile interface property access on function parameter", () => {
    const interfaceSrc = `
      interface IToken {
        name: string;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    const contractSrc = `
      class Helper {
        public getName(token: IToken): string {
          return token.name;
        }
      }
    `;

    const contracts = parse(contractSrc, "Helper.ts", externalTypes);
    const solidity = generateSolidity(contracts[0]);

    expect(solidity).toContain("return token.name();");

    const result = compileSolidity("Helper", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should compile interface method with View<T> return type as view", () => {
    const interfaceSrc = `
      interface IToken {
        balanceOf(account: address): View<number>;
        transfer(to: address, amount: number): boolean;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    // balanceOf should be view due to View<> wrapper
    const balanceOfMethod = contractInterfaces
      .get("IToken")!
      .functions.find((f) => f.name === "balanceOf");
    expect(balanceOfMethod?.stateMutability).toBe("view");

    // transfer should remain unannotated (no View<> wrapper)
    const transferMethod = contractInterfaces
      .get("IToken")!
      .functions.find((f) => f.name === "transfer");
    expect(transferMethod?.stateMutability).toBeUndefined();

    const contractSrc = `
      class TokenVault {
        private _token: IToken;

        constructor(tokenAddress: address) {
          this._token = Contract<IToken>(tokenAddress);
        }

        public getTokenBalance(account: address): number {
          return this._token.balanceOf(account);
        }
      }
    `;

    const contracts = parse(contractSrc, "TokenVault.ts", externalTypes);
    const solidity = generateSolidity(contracts[0]);

    // balanceOf should be compiled as view in the interface
    expect(solidity).toContain(
      "function balanceOf(address account) external view returns (uint256);"
    );
    // transfer should remain without view
    expect(solidity).toContain(
      "function transfer(address to, uint256 amount) external returns (bool);"
    );
    // getTokenBalance should be view since it only calls a view method
    expect(solidity).toMatch(/function getTokenBalance\(.*\) public view\b/);

    const result = compileSolidity("TokenVault", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });

  it("should propagate View<T> mutability from interface to caller function", () => {
    const interfaceSrc = `
      interface IToken {
        balanceOf(account: address): View<number>;
      }
    `;
    const { structs, enums, contractInterfaces } = collectTypes(
      interfaceSrc,
      "IToken.ts"
    );
    const externalTypes = { structs, enums, contractInterfaces };

    const contractSrc = `
      class Checker {
        public checkBalance(tokenAddress: address, account: address): number {
          let token: IToken = Contract<IToken>(tokenAddress);
          return token.balanceOf(account);
        }
      }
    `;

    const contracts = parse(contractSrc, "Checker.ts", externalTypes);
    const checkBalanceFn = contracts[0].functions.find(
      (f) => f.name === "checkBalance"
    );
    expect(checkBalanceFn).toBeDefined();
    // balanceOf is annotated as view via View<>, so checkBalance should be view
    expect(checkBalanceFn!.stateMutability).toBe("view");

    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain(
      "function balanceOf(address account) external view returns (uint256);"
    );

    const result = compileSolidity("Checker", solidity, defaultConfig);
    expect(result.errors).toHaveLength(0);
  });
});

describe("integration: ETH transfers", () => {
  it("should compile addr.transfer(amount) to payable(addr).transfer(amount)", () => {
    const { errors, solidity } = compileTS(`
      class Wallet {
        public withdraw(to: address, amount: number): void {
          to.transfer(amount);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("payable(to).transfer(amount)");
  });

  it("should compile msg.sender.transfer(amount)", () => {
    const { errors, solidity } = compileTS(`
      class Refund {
        public refund(amount: number): void {
          msg.sender.transfer(amount);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("payable(msg.sender).transfer(amount)");
  });

  it("should infer nonpayable for functions with addr.transfer()", () => {
    const { errors, solidity } = compileTS(`
      class Wallet {
        public withdraw(to: address, amount: number): void {
          to.transfer(amount);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).not.toContain("view");
    expect(solidity).not.toContain("pure");
  });
});

// ============================================================
// Address balance
// ============================================================

describe("integration: address.balance", () => {
  it("should compile self.balance to address(this).balance", () => {
    const { errors, solidity } = compileTS(`
      class Vault {
        public getContractBalance(): number {
          return self.balance;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("address(this).balance");
  });

  it("should compile addr.balance for address parameter", () => {
    const { errors, solidity } = compileTS(`
      class Vault {
        public getBalance(addr: address): number {
          return addr.balance;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("addr.balance");
  });

  it("should compile msg.sender.balance", () => {
    const { errors, solidity } = compileTS(`
      class Vault {
        public getSenderBalance(): number {
          return msg.sender.balance;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("msg.sender.balance");
  });

  it("should infer view for self.balance", () => {
    const source = `
      class Vault {
        public getContractBalance(): number {
          return self.balance;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });

  it("should infer view for addr.balance on address parameter", () => {
    const source = `
      class Vault {
        public getBalance(addr: address): number {
          return addr.balance;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });

  it("should infer view for msg.sender.balance", () => {
    const source = `
      class Vault {
        public getSenderBalance(): number {
          return msg.sender.balance;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });

  it("should compile .balance on a locally declared address variable", () => {
    const { errors, solidity } = compileTS(`
      class Vault {
        public getBalance(): number {
          let addr: address = msg.sender;
          return addr.balance;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("addr.balance");
  });

  it("should infer view for .balance on a locally declared address variable", () => {
    const source = `
      class Vault {
        public getBalance(): number {
          let addr: address = msg.sender;
          return addr.balance;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });

  it("should infer view for block.coinbase.balance", () => {
    const source = `
      class Vault {
        public getMinerBalance(): number {
          return block.coinbase.balance;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });

  it("should compile tx.origin.balance", () => {
    const { errors, solidity } = compileTS(`
      class Vault {
        public getOriginBalance(): number {
          return tx.origin.balance;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("tx.origin.balance");
  });

  it("should infer view for tx.origin.balance", () => {
    const source = `
      class Vault {
        public getOriginBalance(): number {
          return tx.origin.balance;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });

  it("should infer view for address(this).balance", () => {
    const source = `
      class Vault {
        public getThisBalance(): number {
          return address(this).balance;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });

  it("should infer view for shadowed local .balance usage", () => {
    const source = `
      class Vault {
        public getShadowedBalance(): number {
          const addr: address = tx.origin;
          if (true) {
            const addr: address = tx.origin;
            return addr.balance;
          }
          return 0;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });

  it("should infer view for conditional .balance usage", () => {
    const source = `
      class Vault {
        public getConditionalBalance(useOrigin: boolean): number {
          return (useOrigin ? tx.origin : msg.sender).balance;
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].stateMutability).toBe("view");
  });
});

// ============================================================
// Same-file inheritance: shared definitions deduplication
// ============================================================

