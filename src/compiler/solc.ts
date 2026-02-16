import solc from "solc";
import type { SkittlesConfig, AbiItem } from "../types";

export interface SolcResult {
  abi: AbiItem[];
  bytecode: string;
  errors: string[];
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

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors: string[] = [];

  if (output.errors) {
    for (const error of output.errors) {
      if (error.severity === "error") {
        errors.push(error.formattedMessage || error.message);
      }
    }
  }

  if (errors.length > 0) {
    return { abi: [], bytecode: "", errors };
  }

  const contractOutput =
    output.contracts?.[`${contractName}.sol`]?.[contractName];

  if (!contractOutput) {
    return {
      abi: [],
      bytecode: "",
      errors: [`No output found for contract ${contractName}`],
    };
  }

  return {
    abi: contractOutput.abi || [],
    bytecode: contractOutput.evm?.bytecode?.object || "",
    errors: [],
  };
}
