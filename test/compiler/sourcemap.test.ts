import { describe, it, expect } from "vitest";
import { parse } from "../../src/compiler/parser";
import { generateSolidity, generateSolidityFile, buildSourceMap } from "../../src/compiler/codegen";

// ============================================================
// Parser: source line capture
// ============================================================

describe("parser source line tracking", () => {
  it("should capture source lines on contract", () => {
    const source = `class Token {
  x: number = 0;
}`;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].sourceLine).toBe(1);
  });

  it("should capture source lines on variables", () => {
    const source = `class Token {
  x: number = 0;
  name: string = "Token";
}`;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].variables[0].sourceLine).toBe(2);
    expect(contracts[0].variables[1].sourceLine).toBe(3);
  });

  it("should capture source lines on functions", () => {
    const source = `class Token {
  getX(): number {
    return this.x;
  }
  setX(val: number) {
    this.x = val;
  }
}`;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].functions[0].sourceLine).toBe(2);
    expect(contracts[0].functions[1].sourceLine).toBe(5);
  });

  it("should capture source lines on constructor", () => {
    const source = `class Token {
  x: number = 0;
  constructor(val: number) {
    this.x = val;
  }
}`;
    const contracts = parse(source, "test.ts");
    expect(contracts[0].ctor?.sourceLine).toBe(3);
  });

  it("should capture source lines on statements", () => {
    const source = `class Token {
  x: number = 0;
  setX(val: number) {
    this.x = val;
    return;
  }
}`;
    const contracts = parse(source, "test.ts");
    const body = contracts[0].functions[0].body;
    expect(body[0].sourceLine).toBe(4);
    expect(body[1].sourceLine).toBe(5);
  });

  it("should capture source lines on if statements", () => {
    const source = `class Token {
  x: number = 0;
  check(val: number) {
    if (val > 0) {
      this.x = val;
    }
  }
}`;
    const contracts = parse(source, "test.ts");
    const body = contracts[0].functions[0].body;
    expect(body[0].kind).toBe("if");
    expect(body[0].sourceLine).toBe(4);
  });

  it("should capture source lines on for loops", () => {
    const source = `class Token {
  count(n: number): number {
    let sum: number = 0;
    for (let i: number = 0; i < n; i++) {
      sum = sum + i;
    }
    return sum;
  }
}`;
    const contracts = parse(source, "test.ts");
    const body = contracts[0].functions[0].body;
    expect(body[0].sourceLine).toBe(3); // let sum
    expect(body[1].sourceLine).toBe(4); // for loop
    expect(body[2].sourceLine).toBe(7); // return
  });
});

// ============================================================
// buildSourceMap: Solidity line -> TypeScript line mapping
// ============================================================

describe("buildSourceMap", () => {
  it("should map contract declaration to TypeScript line", () => {
    const source = `class Token {
  x: number = 0;
}`;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    const sourceMap = buildSourceMap(solidity, contracts, "test.ts");

    expect(sourceMap.sourceFile).toBe("test.ts");
    // Find the Solidity line with "contract Token"
    const solLines = solidity.split("\n");
    const contractLine = solLines.findIndex((l) => l.includes("contract Token")) + 1;
    expect(sourceMap.mappings[contractLine]).toBe(1);
  });

  it("should map variables to TypeScript lines", () => {
    const source = `class Token {
  x: number = 0;
  name: string = "Token";
}`;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    const sourceMap = buildSourceMap(solidity, contracts, "test.ts");

    const solLines = solidity.split("\n");
    const xLine = solLines.findIndex((l) => l.includes("x =")) + 1;
    const nameLine = solLines.findIndex((l) => l.includes("name =")) + 1;
    expect(sourceMap.mappings[xLine]).toBe(2);
    expect(sourceMap.mappings[nameLine]).toBe(3);
  });

  it("should map functions to TypeScript lines", () => {
    const source = `class Token {
  x: number = 0;
  getX(): number {
    return this.x;
  }
}`;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    const sourceMap = buildSourceMap(solidity, contracts, "test.ts");

    const solLines = solidity.split("\n");
    const funcLine = solLines.findIndex((l) => l.includes("function getX")) + 1;
    expect(sourceMap.mappings[funcLine]).toBe(3);
  });

  it("should map constructor to TypeScript line", () => {
    const source = `class Token {
  x: number = 0;
  constructor(val: number) {
    this.x = val;
  }
}`;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    const sourceMap = buildSourceMap(solidity, contracts, "test.ts");

    const solLines = solidity.split("\n");
    const ctorLine = solLines.findIndex((l) => l.includes("constructor(")) + 1;
    expect(sourceMap.mappings[ctorLine]).toBe(3);
  });

  it("should map function body statements to TypeScript lines", () => {
    const source = `class Token {
  x: number = 0;
  setX(val: number) {
    this.x = val;
  }
}`;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    const sourceMap = buildSourceMap(solidity, contracts, "test.ts");

    const solLines = solidity.split("\n");
    const stmtLine = solLines.findIndex((l) => l.includes("x = val")) + 1;
    expect(sourceMap.mappings[stmtLine]).toBe(4);
  });

  it("should produce mappings for a contract with multiple elements", () => {
    const source = `class Token {
  totalSupply: number = 1000;
  constructor(supply: number) {
    this.totalSupply = supply;
  }
  getSupply(): number {
    return this.totalSupply;
  }
  setSupply(val: number) {
    this.totalSupply = val;
  }
}`;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    const sourceMap = buildSourceMap(solidity, contracts, "test.ts");

    // Should have entries for: contract, variable, constructor, constructor body,
    // function1, function1 body, function2, function2 body
    const entryCount = Object.keys(sourceMap.mappings).length;
    expect(entryCount).toBeGreaterThanOrEqual(6);
  });

  it("should map statements inside if blocks", () => {
    const source = `class Guard {
  owner: string = "";
  check(caller: string) {
    if (caller == this.owner) {
      return;
    }
  }
}`;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    const sourceMap = buildSourceMap(solidity, contracts, "test.ts");

    // The if statement should be mapped
    const solLines = solidity.split("\n");
    const ifLine = solLines.findIndex((l) => l.includes("if (")) + 1;
    if (ifLine > 0) {
      expect(sourceMap.mappings[ifLine]).toBe(4);
    }
  });

  it("should work with generateSolidityFile for multiple contracts", () => {
    const source = `class A {
  x: number = 0;
}
class B {
  y: number = 0;
}`;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidityFile(contracts);
    const sourceMap = buildSourceMap(solidity, contracts, "test.ts");

    const solLines = solidity.split("\n");
    const aLine = solLines.findIndex((l) => l.includes("contract A")) + 1;
    const bLine = solLines.findIndex((l) => l.includes("contract B")) + 1;
    expect(sourceMap.mappings[aLine]).toBe(1);
    expect(sourceMap.mappings[bLine]).toBe(4);
  });

  it("should use 1-based line numbers in both source and target", () => {
    const source = `class Token {
  x: number = 0;
}`;
    const contracts = parse(source, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    const sourceMap = buildSourceMap(solidity, contracts, "test.ts");

    // All Solidity line numbers should be >= 1
    for (const solLine of Object.keys(sourceMap.mappings)) {
      expect(Number(solLine)).toBeGreaterThanOrEqual(1);
    }
    // All TypeScript line numbers should be >= 1
    for (const tsLine of Object.values(sourceMap.mappings)) {
      expect(tsLine).toBeGreaterThanOrEqual(1);
    }
  });
});
