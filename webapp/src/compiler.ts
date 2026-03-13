import { parse, collectTypes, collectFunctions, generateSolidity, generateSolidityFile, getErrorMessage } from "skittles";

const PLAYGROUND_FILENAME = "playground.ts";

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
    const { structs, enums, contractInterfaces } = collectTypes(source, PLAYGROUND_FILENAME);
    const { functions, constants } = collectFunctions(source, PLAYGROUND_FILENAME);
    const externalTypes = { structs, enums, contractInterfaces };
    const externalFunctions = { functions, constants };

    const contracts = parse(source, PLAYGROUND_FILENAME, externalTypes, externalFunctions);
    if (contracts.length === 0) {
      return { solidity: "", error: "No contract class found. Define a class to compile." };
    }

    const solidity =
      contracts.length > 1
        ? generateSolidityFile(contracts)
        : generateSolidity(contracts[0]);

    return { solidity, error: null };
  } catch (err) {
    const message = getErrorMessage(err, "Unknown compilation error");
    return { solidity: "", error: message };
  }
}
