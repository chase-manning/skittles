import type { SkittlesContract } from "../types/index.ts";
import { generateSolidityForContracts } from "./codegen.ts";
import { collectFunctions, collectTypes, parse } from "./parser.ts";

export interface CompilePipelineResult {
  contracts: SkittlesContract[];
  solidity: string;
}

/**
 * Shared compile pipeline: parse TypeScript source and generate Solidity.
 *
 * Internally calls collectTypes → collectFunctions → parse → generateSolidityForContracts.
 * This is the single authoritative implementation of the parse→generate flow.
 */
export function compileToSolidity(
  source: string,
  filePath: string
): CompilePipelineResult {
  const { structs, enums, contractInterfaces } = collectTypes(
    source,
    filePath
  );
  const { functions, constants } = collectFunctions(source, filePath);
  const externalTypes = { structs, enums, contractInterfaces };
  const externalFunctions = { functions, constants };

  const contracts = parse(source, filePath, externalTypes, externalFunctions);
  const solidity = generateSolidityForContracts(contracts);

  return { contracts, solidity };
}
