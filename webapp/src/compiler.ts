import { compileToSolidity, getErrorMessage } from "skittles";

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
    const { contracts, solidity } = compileToSolidity(source, PLAYGROUND_FILENAME);
    if (contracts.length === 0) {
      return { solidity: "", error: "No contract class found. Define a class to compile." };
    }

    return { solidity, error: null };
  } catch (err) {
    const message = getErrorMessage(err, "Unknown compilation error");
    return { solidity: "", error: message };
  }
}
