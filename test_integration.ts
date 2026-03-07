import { describe, it, expect } from "vitest";
import { parse, generateSolidity } from "./src";

describe("test template literals with numbers", () => {
  it("should handle uint256 in template literal", () => {
    const code = `
      class Test {
        public getId(id: number): string {
          return \`Token #\${id}\`;
        }
      }
    `;
    const contracts = parse(code, "test.ts");
    const solidity = generateSolidity(contracts[0]);
    console.log("=== GENERATED SOLIDITY ===");
    console.log(solidity);
    expect(solidity).toContain("string.concat");
  });
});
