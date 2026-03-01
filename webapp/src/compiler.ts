import { parse, collectTypes, collectFunctions } from "../../src/compiler/parser.ts";
import { generateSolidity, generateSolidityFile } from "../../src/compiler/codegen.ts";

export interface CompileResult {
  solidity: string;
  error: string | null;
}

/**
 * Compile TypeScript contract source to Solidity.
 * Browser-compatible wrapper around the Skittles parser and codegen.
 */
export function compileSource(source: string): CompileResult {
  try {
    // Collect shared types from the source (structs, enums, interfaces)
    const { structs, enums, contractInterfaces } = collectTypes(source, "playground.ts");
    const { functions, constants } = collectFunctions(source, "playground.ts");
    const externalTypes = { structs, enums, contractInterfaces };
    const externalFunctions = { functions, constants };

    const contracts = parse(source, "playground.ts", externalTypes, externalFunctions);
    if (contracts.length === 0) {
      return { solidity: "", error: "No contract class found. Export a class to compile." };
    }

    const solidity =
      contracts.length > 1
        ? generateSolidityFile(contracts)
        : generateSolidity(contracts[0]);

    return { solidity, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown compilation error";
    return { solidity: "", error: message };
  }
}
