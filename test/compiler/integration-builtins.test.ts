import { describe, expect,it } from "vitest";

import {
  generateSolidity,
  generateSolidityFile,
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

describe("integration: built-in functions", () => {
  it("should compile keccak256 to keccak256(abi.encodePacked(...))", () => {
    const contracts = parse(
      `
      class Hasher {
        public hash(a: number, b: number): void {
          let h = keccak256(a, b);
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("keccak256(abi.encodePacked(a, b))");
  });

  it("should compile abi.encodePacked", () => {
    const contracts = parse(
      `
      class Encoder {
        public encode(a: number, b: number): void {
          let d = abi.encodePacked(a, b);
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("abi.encodePacked(a, b)");
  });

  it("should compile abi.decode with type parameters", () => {
    const contracts = parse(
      `
      class Decoder {
        public decode(data: string): void {
          let result = abi.decode<[number, address]>(data);
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("abi.decode(data, (uint256, address))");
  });

  it("should compile abi.decode with a single type parameter", () => {
    const contracts = parse(
      `
      class Decoder {
        public decode(data: string): void {
          let result = abi.decode<[number]>(data);
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("abi.decode(data, (uint256))");
  });

  it("should compile abi.decode without type parameters", () => {
    const contracts = parse(
      `
      class Decoder {
        public decode(data: string): void {
          let result = abi.decode(data);
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("abi.decode(data)");
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
    const contracts = parse(
      `
      class Hasher {
        public singleHash(a: number): void {
          let h = hash(a);
        }
        public multiHash(a: number, b: address, c: boolean): void {
          let h = hash(a, b, c);
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("keccak256(abi.encodePacked(a))");
    expect(solidity).toContain("keccak256(abi.encodePacked(a, b, c))");
  });

  it("should compile keccak256 with bytes32 return type", () => {
    const { errors, solidity } = compileTS(`
      class Hasher {
        public getHash(a: number, b: number): bytes32 {
          return keccak256(a, b);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("returns (bytes32)");
    expect(solidity).toContain("keccak256(abi.encodePacked(a, b))");
  });

  it("should infer bytes32 type for keccak256 call without annotation", () => {
    const { errors, solidity } = compileTS(`
      class Hasher {
        public hashAndStore(a: number): void {
          const digest = keccak256(a);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "bytes32 digest = keccak256(abi.encodePacked(a))"
    );
  });

  it("should infer bytes32 type for sha256 call without annotation", () => {
    const { errors, solidity } = compileTS(`
      class Hasher {
        public hashAndStore(a: number): void {
          const digest = sha256(a);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("bytes32 digest = sha256(abi.encodePacked(a))");
  });

  it("should infer bytes32 type for hash() alias without annotation", () => {
    const { errors, solidity } = compileTS(`
      class Hasher {
        public hashAndStore(a: number): void {
          const digest = hash(a);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "bytes32 digest = keccak256(abi.encodePacked(a))"
    );
  });

  it("should compile bytes32 state variable", () => {
    const { errors, solidity } = compileTS(`
      class CommitReveal {
        public commitment: bytes32;
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("bytes32 public commitment;");
  });

  it("should compile bytes32 as mapping key", () => {
    const { errors, solidity } = compileTS(`
      class MerkleVerifier {
        private nodes: Record<bytes32, boolean> = {};
        public isKnown(h: bytes32): boolean {
          return this.nodes[h];
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("mapping(bytes32 => bool)");
  });

  it("should compile bytes32 function parameter", () => {
    const { errors, solidity } = compileTS(`
      class Verifier {
        public verify(hash: bytes32): boolean {
          return hash != bytes32(0);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function verify(bytes32 hash)");
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

  it("should compile Math.min using helper function", () => {
    const contracts = parse(
      `
      class MathTest {
        public getMin(a: number, b: number): number {
          return Math.min(a, b);
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("_min(a, b)");
    expect(solidity).toContain(
      "function _min(uint256 a, uint256 b) internal pure returns (uint256)"
    );
  });

  it("should compile Math.max using helper function", () => {
    const contracts = parse(
      `
      class MathTest {
        public getMax(a: number, b: number): number {
          return Math.max(a, b);
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("_max(a, b)");
    expect(solidity).toContain(
      "function _max(uint256 a, uint256 b) internal pure returns (uint256)"
    );
  });

  it("should compile nested Math.min and Math.max (clamp)", () => {
    const { errors, solidity } = compileTS(`
      class Clamper {
        public clamp(value: number, min: number, max: number): number {
          return Math.min(Math.max(value, min), max);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_min(_max(value, min), max)");
  });

  it("should compile Math.pow to exponentiation", () => {
    const contracts = parse(
      `
      class MathTest {
        public power(base: number, exp: number): number {
          return Math.pow(base, exp);
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("(base ** exp)");
  });

  it("should compile Math.sqrt and generate helper function", () => {
    const { errors, solidity } = compileTS(`
      class MathTest {
        public root(x: number): number {
          return Math.sqrt(x);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_sqrt(x)");
    expect(solidity).toContain(
      "function _sqrt(uint256 x) internal pure returns (uint256)"
    );
    expect(solidity).toContain("uint256 z = (x + 1) / 2;");
  });

  it("should wrap ecrecover v argument in uint8() cast", () => {
    const { errors, solidity } = compileTS(`
      class SigVerifier {
        public recover(h: bytes32, v: number, r: bytes32, s: bytes32): address {
          return ecrecover(h, v, r, s);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("ecrecover(h, uint8(v), r, s)");
  });
});

// ============================================================
// String operations
// ============================================================

describe("integration: string operations", () => {
  it("should compile string.length on parameter to bytes(str).length", () => {
    const { errors, solidity } = compileTS(`
      class StringLen {
        public getLength(text: string): number {
          return text.length;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("bytes(text).length");
  });

  it("should compile string.length on state variable to bytes(str).length", () => {
    const { errors, solidity } = compileTS(`
      class StringLen {
        public name: string = "hello";

        public getNameLength(): number {
          return this.name.length;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("bytes(name).length");
  });

  it("should compile string.length on string literal to bytes(str).length", () => {
    const contracts = parse(
      `
      class StringLen {
        public getLength(): number {
          return "hello".length;
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain('bytes("hello").length');
  });

  it("should compile string comparison with === to keccak256", () => {
    const { errors, solidity } = compileTS(`
      class StringCmp {
        public isHello(text: string): boolean {
          return text === "hello";
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("keccak256(abi.encodePacked(text))");
    expect(solidity).toContain('keccak256(abi.encodePacked("hello"))');
    expect(solidity).toContain("==");
  });

  it("should compile string comparison with !== to keccak256 with !=", () => {
    const { errors, solidity } = compileTS(`
      class StringCmp {
        public isNotHello(text: string): boolean {
          return text !== "hello";
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("keccak256(abi.encodePacked(text))");
    expect(solidity).toContain("!=");
  });

  it("should compile string comparison between two parameters", () => {
    const { errors, solidity } = compileTS(`
      class StringCmp {
        public isEqual(a: string, b: string): boolean {
          return a === b;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("keccak256(abi.encodePacked(a))");
    expect(solidity).toContain("keccak256(abi.encodePacked(b))");
  });

  it("should compile string comparison on state variable", () => {
    const { errors, solidity } = compileTS(`
      class StringCmp {
        public name: string = "hello";

        public isHello(): boolean {
          return this.name === "hello";
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("keccak256(abi.encodePacked(name))");
    expect(solidity).toContain('keccak256(abi.encodePacked("hello"))');
  });

  it("should not transform array.length", () => {
    const { errors, solidity } = compileTS(`
      class ArrLen {
        public items: number[] = [];

        public count(): number {
          return this.items.length;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("items.length");
    expect(solidity).not.toContain("bytes(");
  });

  it("should not transform number comparison", () => {
    const { errors, solidity } = compileTS(`
      class NumCmp {
        public isEqual(a: number, b: number): boolean {
          return a == b;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("(a == b)");
    expect(solidity).not.toContain("keccak256");
  });

  it("should not transform address comparison with zero address literal", () => {
    const { errors, solidity } = compileTS(`
      class AddrCmp {
        public isZero(addr: address): boolean {
          return addr == "0x0000000000000000000000000000000000000000";
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "(addr == address(0x0000000000000000000000000000000000000000))"
    );
    expect(solidity).not.toContain("keccak256");
  });

  it("should not transform address != comparison with zero address literal", () => {
    const { errors, solidity } = compileTS(`
      class AddrCmp {
        public isNonZero(addr: address): boolean {
          return addr != "0x0000000000000000000000000000000000000000";
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "(addr != address(0x0000000000000000000000000000000000000000))"
    );
    expect(solidity).not.toContain("keccak256");
  });

  it("should still transform string comparison with keccak256", () => {
    const { errors, solidity } = compileTS(`
      class StrCmp {
        public isHello(text: string): boolean {
          return text == "hello";
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("keccak256(abi.encodePacked(text))");
    expect(solidity).toContain('keccak256(abi.encodePacked("hello"))');
  });

  it("should not transform address comparison when zero address is stored in a variable", () => {
    const { errors, solidity } = compileTS(`
      class AddrCmpVar {
        public isZero(addr: address): boolean {
          const ZERO = "0x0000000000000000000000000000000000000000";
          return addr == ZERO;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "address ZERO = address(0x0000000000000000000000000000000000000000)"
    );
    expect(solidity).toContain("(addr == ZERO)");
    expect(solidity).not.toContain("keccak256");
  });
});

// ============================================================
// String methods
// ============================================================

describe("integration: string methods", () => {
  it("should compile charAt on parameter", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public getInitial(name: string): string {
          return name.charAt(0);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_charAt(name, 0)");
    expect(solidity).toContain(
      "function _charAt(string memory str, uint256 index)"
    );
  });

  it("should compile charAt on state variable", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public name: string = "hello";

        public getInitial(): string {
          return this.name.charAt(0);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_charAt(name, 0)");
  });

  it("should compile substring on parameter", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public getSlice(text: string): string {
          return text.substring(0, 3);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_substring(text, 0, 3)");
    expect(solidity).toContain(
      "function _substring(string memory str, uint256 start, uint256 end)"
    );
  });

  it("should compile toLowerCase on parameter", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public lower(text: string): string {
          return text.toLowerCase();
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_toLowerCase(text)");
    expect(solidity).toContain("function _toLowerCase(string memory str)");
  });

  it("should compile toUpperCase on parameter", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public upper(text: string): string {
          return text.toUpperCase();
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_toUpperCase(text)");
    expect(solidity).toContain("function _toUpperCase(string memory str)");
  });

  it("should compile startsWith on parameter", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public checkPrefix(text: string, prefix: string): boolean {
          return text.startsWith(prefix);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_startsWith(text, prefix)");
    expect(solidity).toContain(
      "function _startsWith(string memory str, string memory prefix)"
    );
  });

  it("should compile endsWith on parameter", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public checkSuffix(text: string, suffix: string): boolean {
          return text.endsWith(suffix);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_endsWith(text, suffix)");
    expect(solidity).toContain(
      "function _endsWith(string memory str, string memory suffix)"
    );
  });

  it("should compile trim on parameter", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public clean(text: string): string {
          return text.trim();
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_trim(text)");
    expect(solidity).toContain("function _trim(string memory str)");
  });

  it("should compile split on parameter", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public splitText(text: string, delimiter: string): string[] {
          return text.split(delimiter);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_split(text, delimiter)");
    expect(solidity).toContain(
      "function _split(string memory str, string memory delimiter)"
    );
  });

  it("should not shadow state variable 'count' in _split helper", () => {
    const { errors, solidity } = compileTS(`
      class PrimitiveTypes {
        public count: number = 0;
        public tokenize(csv: string): string[] {
          return csv.split(",");
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("uint256 public count");
    expect(solidity).not.toMatch(/\buint256 count\b/);
    expect(solidity).toContain("__sk_count");
  });

  it("should compile replace on parameter", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public replaceFirst(text: string, from: string, to: string): string {
          return text.replace(from, to);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_replace(text, from, to)");
    expect(solidity).toContain(
      "function _replace(string memory str, string memory search, string memory replacement)"
    );
    expect(solidity).toContain("require(searchBytes.length > 0)");
  });

  it("should compile replaceAll on parameter", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public sanitize(input: string): string {
          return input.replaceAll(" ", "_");
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain('_replaceAll(input, " ", "_")');
    expect(solidity).toContain(
      "function _replaceAll(string memory str, string memory search, string memory replacement)"
    );
    expect(solidity).toContain("require(searchBytes.length > 0)");
  });

  it("should validate replace arity with too few arguments", () => {
    expect(() =>
      parse(
        `
      class StringMethods {
        public replaceFirst(text: string): string {
          return text.replace("a");
        }
      }
    `,
        "test.ts"
      )
    ).toThrow(/replace.*requires at least 2 argument/);
  });

  it("should validate replace arity with too many arguments", () => {
    expect(() =>
      parse(
        `
      class StringMethods {
        public replaceFirst(text: string): string {
          return text.replace("a", "b", "c");
        }
      }
    `,
        "test.ts"
      )
    ).toThrow(/replace.*accepts at most 2 argument/);
  });

  it("should validate replaceAll arity with too few arguments", () => {
    expect(() =>
      parse(
        `
      class StringMethods {
        public sanitize(input: string): string {
          return input.replaceAll(" ");
        }
      }
    `,
        "test.ts"
      )
    ).toThrow(/replaceAll.*requires at least 2 argument/);
  });

  it("should validate replaceAll arity with too many arguments", () => {
    expect(() =>
      parse(
        `
      class StringMethods {
        public sanitize(input: string): string {
          return input.replaceAll(" ", "_", "extra");
        }
      }
    `,
        "test.ts"
      )
    ).toThrow(/replaceAll.*accepts at most 2 argument/);
  });

  it("should compile chained string methods", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public getUpperInitial(name: string): string {
          return name.charAt(0).toUpperCase();
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_toUpperCase(_charAt(name, 0))");
  });

  it("should compile string methods on string literals", () => {
    const contracts = parse(
      `
      class StringMethods {
        public getFirst(): string {
          return "hello".charAt(0);
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain('_charAt("hello", 0)');
  });

  it("should only inject helpers that are used", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public getInitial(name: string): string {
          return name.charAt(0);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("function _charAt(");
    expect(solidity).not.toContain("function _substring(");
    expect(solidity).not.toContain("function _toLowerCase(");
    expect(solidity).not.toContain("function _toUpperCase(");
    expect(solidity).not.toContain("function _startsWith(");
    expect(solidity).not.toContain("function _endsWith(");
    expect(solidity).not.toContain("function _trim(");
    expect(solidity).not.toContain("function _split(");
    expect(solidity).not.toContain("function _replace(");
    expect(solidity).not.toContain("function _replaceAll(");
  });

  it("should infer string type from charAt result", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public getInitial(name: string): string {
          const first = name.charAt(0);
          return first;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("string memory first = _charAt(name, 0)");
  });

  it("should infer boolean type from startsWith result", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public checkPrefix(text: string, prefix: string): boolean {
          const result = text.startsWith(prefix);
          return result;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("bool result = _startsWith(text, prefix)");
  });

  it("should compile string methods on state variable with string concat result", () => {
    const contracts = parse(
      `
      class StringMethods {
        public name: string = "hello";

        public getUpperName(): string {
          return this.name.toUpperCase();
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain("_toUpperCase(name)");
  });

  it("should not transform non-string method calls", () => {
    const { errors, solidity } = compileTS(`
      class Example {
        public items: number[] = [];

        public getCount(): number {
          return this.items.length;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).not.toContain("_charAt");
    expect(solidity).not.toContain("_substring");
  });

  it("should compile substring with single argument (start only)", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public getSuffix(text: string): string {
          return text.substring(3);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_substring(text, 3, bytes(text).length)");
  });

  it("should compile charAt with no argument defaulting to index 0", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public getFirst(text: string): string {
          return text.charAt();
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("_charAt(text, 0)");
  });

  it("should generate split helper with empty delimiter guard", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public tokenize(text: string, sep: string): string[] {
          return text.split(sep);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("require(delimBytes.length > 0)");
  });

  it("should throw on startsWith with unsupported position argument", () => {
    expect(() =>
      parse(
        `
      class StringMethods {
        public check(text: string, prefix: string): boolean {
          return text.startsWith(prefix, 5);
        }
      }
    `,
        "test.ts"
      )
    ).toThrow(/startsWith.*accepts at most 1 argument/);
  });

  it("should throw on endsWith with unsupported length argument", () => {
    expect(() =>
      parse(
        `
      class StringMethods {
        public check(text: string, suffix: string): boolean {
          return text.endsWith(suffix, 3);
        }
      }
    `,
        "test.ts"
      )
    ).toThrow(/endsWith.*accepts at most 1 argument/);
  });

  it("should throw on split with unsupported extra argument", () => {
    expect(() =>
      parse(
        `
      class StringMethods {
        public tokenize(text: string): string[] {
          return text.split(",", 2);
        }
      }
    `,
        "test.ts"
      )
    ).toThrow(/split.*accepts at most 1 argument/);
  });

  it("should throw on toLowerCase with unexpected argument", () => {
    expect(() =>
      parse(
        `
      class StringMethods {
        public lower(text: string): string {
          return text.toLowerCase("en");
        }
      }
    `,
        "test.ts"
      )
    ).toThrow(/toLowerCase.*accepts at most 0 argument/);
  });

  it("should generate charAt helper with bounds check", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public getChar(text: string, i: number): string {
          return text.charAt(i);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("require(index < strBytes.length)");
  });

  it("should generate substring helper with range validation", () => {
    const { errors, solidity } = compileTS(`
      class StringMethods {
        public slice(text: string): string {
          return text.substring(1, 3);
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      "require(start <= end && end <= strBytes.length)"
    );
  });

  it("should not duplicate helper functions in child contract when parent already has them", () => {
    const source = `
      class Parent {
        public getInitial(name: string): string {
          return name.charAt(0);
        }
      }

      class Child extends Parent {
        public getUpper(name: string): string {
          return name.charAt(0).toUpperCase();
        }
      }
    `;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidityFile(contracts);
    const charAtCount = (solidity.match(/function _charAt\(/g) ?? []).length;
    expect(charAtCount).toBe(1);
    expect(solidity).toContain("function _toUpperCase(");
  });
});

// ============================================================
// Structs
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
    const contracts = parse(
      `
      class Formatter {
        public format(a: string, b: string): string {
          return \`\${a} and \${b}\`;
        }
      }
    `,
      "test.ts"
    );
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

  it("should convert number to string in template literals", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        public label(tokenId: number): string {
          return \`Token #\${tokenId}\`;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      'string.concat("Token #", __sk_toString(tokenId))'
    );
    expect(solidity).toContain("function __sk_toString(uint256 value)");
  });

  it("should handle multiple interpolations with mixed types", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        public info(name: string, balance: number): string {
          return \`\${name} has \${balance} tokens\`;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      'string.concat(name, " has ", __sk_toString(balance), " tokens")'
    );
  });

  it("should convert expressions in template literals", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        public doubleBalance(balance: number): string {
          return \`Balance: \${balance * 2}\`;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain(
      'string.concat("Balance: ", __sk_toString((balance * 2)))'
    );
  });

  it("should convert this.property number to string in template literals", () => {
    const contracts = parse(
      `
      class Token {
        private supply: number = 0;
        public getSupply(): string {
          return \`Supply: \${this.supply}\`;
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain(
      'string.concat("Supply: ", __sk_toString(supply))'
    );
  });

  it("should handle number literal in template literals", () => {
    const contracts = parse(
      `
      class Token {
        public version(): string {
          return \`v\${1}\`;
        }
      }
    `,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain('string.concat("v", __sk_toString(1))');
  });

  it("should convert locally-declared number to string in template literals", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        public doubleBalanceViaLocal(balance: number): string {
          const total: number = balance * 2;
          return \`\${total}\`;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("__sk_toString(total)");
  });

  it("should not wrap string-returning function calls in template literals", () => {
    const { errors, solidity } = compileTS(`
      class Greeter {
        public greet(name: string): string {
          return \`Hello \${name}\`;
        }
        public welcome(name: string): string {
          return \`Welcome: \${this.greet(name)}\`;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain('string.concat("Welcome: ", greet(name))');
    expect(solidity).not.toContain("__sk_toString(greet(name))");
  });

  it("should wrap this.<stateVar> even when a local shadows the state variable name", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        count: number = 0;
        public describe(): string {
          const count: string = "shadow";
          return \`Count: \${this.count}\`;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("__sk_toString(count)");
  });

  it("should not wrap a local string variable that shadows a numeric state var", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        count: number = 0;
        public describe(): string {
          const count: string = "shadow";
          return \`Value: \${count}\`;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).not.toContain("__sk_toString");
    // Codegen renames shadowing local to _count
    expect(solidity).toContain('string.concat("Value: ", _count)');
  });

  it("should not wrap a parameter that shadows a numeric state var", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        count: number = 0;
        public describe(count: string): string {
          return \`Value: \${count}\`;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).not.toContain("__sk_toString");
    expect(solidity).toContain('string.concat("Value: ", count)');
  });

  it("should convert ternary expression in template literals", () => {
    const { errors, solidity } = compileTS(`
      class Token {
        public label(flag: boolean): string {
          return \`\${flag ? 1 : 2}\`;
        }
      }
    `);
    expect(errors).toHaveLength(0);
    expect(solidity).toContain("__sk_toString(");
  });
});

describe("integration: console.log", () => {
  it("should compile console.log to Solidity console.log with import", () => {
    const contracts = parse(
      `class Debug {
        public test(): number {
          console.log("hello");
          return 42;
        }
      }`,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain('import "hardhat/console.sol";');
    expect(solidity).toContain('console.log("hello");');
    expect(solidity).toContain("return 42;");
  });

  it("should compile console.log with multiple arguments", () => {
    const contracts = parse(
      `class Debug {
        public test(x: number): void {
          console.log("value:", x);
        }
      }`,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).toContain('import "hardhat/console.sol";');
    expect(solidity).toContain('console.log("value:", x);');
  });

  it("should not include console import when no console.log is used", () => {
    const contracts = parse(
      `class NoDebug {
        public test(): number {
          return 42;
        }
      }`,
      "test.ts"
    );
    const solidity = generateSolidity(contracts[0]);
    expect(solidity).not.toContain("hardhat/console.sol");
  });
});

// ============================================================
// External contract calls via Contract<T>()
// ============================================================

describe("integration: array sort", () => {
  it("should throw on boolean comparator for .sort()", () => {
    expect(() =>
      parse(
        `
        class SortTest {
          values: number[] = [];
          public sortValues(): void {
            this.values.sort((a, b) => a > b);
          }
        }
      `,
        "test.ts"
      )
    ).toThrow(/sort\(\) comparator must return a signed or unsigned integer/);
  });

  it("should compile .sort() with subtraction comparator", () => {
    const { solidity } = compileTS(`
      class SortTest {
        values: number[] = [];
        public sortAscending(): void {
          this.values.sort((a, b) => a - b);
        }
      }
    `);
    expect(solidity).toContain("function _sort_");
    expect(solidity).toContain("int256");
  });

  it("should accept ternary numeric comparator for .sort()", () => {
    expect(() =>
      parse(
        `
        class SortTest {
          values: number[] = [];
          public sortValues(): void {
            this.values.sort((a, b) => a > b ? 1 : 0);
          }
        }
      `,
        "test.ts"
      )
    ).not.toThrow();
  });

  it("should throw on .sort() with no arguments", () => {
    expect(() =>
      parse(
        `
        class SortTest {
          values: number[] = [];
          public sortValues(): void {
            this.values.sort();
          }
        }
      `,
        "test.ts"
      )
    ).toThrow(/sort\(\) requires a comparator callback/);
  });
});

// ============================================================
// Nullish coalescing (??) and optional chaining (?.)
// ============================================================

