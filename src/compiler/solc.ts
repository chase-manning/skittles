import solc from "solc";

import type { AbiItem,SkittlesConfig } from "../types/index.ts";
import { BATCH_SOURCE_FILENAME } from "./constants.ts";
import { getErrorMessage } from "../utils/error.ts";

export interface SolcResult {
  abi: AbiItem[];
  bytecode: string;
  errors: string[];
  warnings: string[];
}

export interface SolcBatchResult {
  contracts: Record<string, { abi: AbiItem[]; bytecode: string }>;
  errors: string[];
  warnings: string[];
}

/** Raw output returned by the shared `runSolc` helper. */
interface SolcRawOutput {
  /** Parsed solc JSON output, or `undefined` when compilation threw. */
  output: Record<string, unknown> | undefined;
  errors: string[];
  warnings: string[];
}

/**
 * Shared core that constructs solc input JSON, invokes `solc.compile()`, and
 * classifies any diagnostics into errors / warnings.
 */
function runSolc(
  sources: Record<string, string>,
  config: Required<SkittlesConfig>
): SolcRawOutput {
  const sourcesInput: Record<string, { content: string }> = {};
  for (const [name, content] of Object.entries(sources)) {
    sourcesInput[name] = { content };
  }

  const input = {
    language: "Solidity",
    sources: sourcesInput,
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
    const msg = getErrorMessage(err, String(err));
    return {
      output: undefined,
      errors: [`Solc compilation failed: ${msg}`],
      warnings: [],
    };
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

  return { output, errors, warnings };
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
  const sourceFileName = `${contractName}.sol`;
  const raw = runSolc({ [sourceFileName]: soliditySource }, config);

  if (raw.errors.length > 0) {
    return { abi: [], bytecode: "", errors: raw.errors, warnings: raw.warnings };
  }

  const output = raw.output as Record<string, unknown>;
  const contractOutput =
    (output.contracts as Record<string, Record<string, unknown>>)?.[sourceFileName]?.[contractName] as
      | { abi?: AbiItem[]; evm?: { bytecode?: { object?: string } } }
      | undefined;

  if (!contractOutput) {
    return {
      abi: [],
      bytecode: "",
      errors: [`No output found for contract ${contractName}`],
      warnings: raw.warnings,
    };
  }

  return {
    abi: contractOutput.abi || [],
    bytecode: contractOutput.evm?.bytecode?.object || "",
    errors: [],
    warnings: raw.warnings,
  };
}

/**
 * Compile Solidity source code once and extract ABI + bytecode for
 * every requested contract. This avoids redundant solc invocations
 * when a single Solidity unit contains multiple contracts.
 */
export function compileSolidityBatch(
  soliditySource: string,
  contractNames: string[],
  config: Required<SkittlesConfig>
): SolcBatchResult {
  const sourceFileName = BATCH_SOURCE_FILENAME;
  const raw = runSolc({ [sourceFileName]: soliditySource }, config);

  if (raw.errors.length > 0) {
    return { contracts: {}, errors: raw.errors, warnings: raw.warnings };
  }

  const output = raw.output as Record<string, unknown>;
  const fileContracts =
    (output.contracts as Record<string, Record<string, unknown>>)?.[sourceFileName] ?? {};
  const result: Record<string, { abi: AbiItem[]; bytecode: string }> = {};

  for (const name of contractNames) {
    const contractOutput = fileContracts[name] as
      | { abi?: AbiItem[]; evm?: { bytecode?: { object?: string } } }
      | undefined;
    if (contractOutput) {
      result[name] = {
        abi: contractOutput.abi || [],
        bytecode: contractOutput.evm?.bytecode?.object || "",
      };
    }
  }

  return { contracts: result, errors: [], warnings: raw.warnings };
}
