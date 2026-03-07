import { parse, generateSolidity } from "./src/index";

const code = `
class Test {
  public greet(tokenId: number): string {
    return \`Token #\${tokenId}\`;
  }
}
`;

try {
  const contracts = parse(code, "test.ts");
  const solidity = generateSolidity(contracts[0]);
  console.log("=== GENERATED SOLIDITY ===");
  console.log(solidity);
} catch (err) {
  console.error("Error:", err);
}
