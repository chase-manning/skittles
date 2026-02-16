import solc from "solc";
import type { SkittlesConfig, AbiItem } from "../types";

export interface SolcResult {
  abi: AbiItem[];
  bytecode: string;
  errors: string[];
  warnings: string[];
}

/**
 * Compile Solidity source code to ABI and bytecode using solc.
 *
 * This is the final compilation stage: Solidity -> EVM bytecode.
 */
export function compileSolidity(
  contractName: string,
  soliditySource: string,
  config: Required<SkittlesConfig>
): SolcResult {
  const input = {
    language: "Solidity",
    sources: {
      [`${contractName}.sol`]: {
        content: soliditySource,
      },
    },
    settings: {
      optimizer: {
        enabled: config.optimizer.enabled,
        runs: config.optimizer.runs,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  let output;
  try {
    output = JSON.parse(solc.compile(JSON.stringify(input)));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { abi: [], bytecode: "", errors: [`Solc compilation failed: ${msg}`], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  if (output.errors) {
    for (const error of output.errors) {
      const message = error.formattedMessage || error.message;
      if (error.severity === "error") {
        errors.push(message);
      } else if (error.severity === "warning") {
        warnings.push(message);
      }
    }
  }

  if (errors.length > 0) {
    return { abi: [], bytecode: "", errors, warnings };
  }

  const contractOutput =
    output.contracts?.[`${contractName}.sol`]?.[contractName];

  if (!contractOutput) {
    return {
      abi: [],
      bytecode: "",
      errors: [`No output found for contract ${contractName}`],
      warnings,
    };
  }

  return {
    abi: contractOutput.abi || [],
    bytecode: contractOutput.evm?.bytecode?.object || "",
    errors: [],
    warnings,
  };
}
