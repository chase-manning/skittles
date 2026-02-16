import path from "path";
import type {
  SkittlesConfig,
  SkittlesContract,
  BuildArtifact,
} from "../types";
import { findTypeScriptFiles, readFile, writeFile } from "../utils/file";
import { logInfo, logSuccess, logError, logWarning } from "../utils/console";
import { parse, collectTypes } from "./parser";
import type { SkittlesParameter } from "../types";
import { generateSolidity, generateSolidityFile } from "./codegen";
import { compileSolidity } from "./solc";

export interface CompilationResult {
  success: boolean;
  artifacts: BuildArtifact[];
  errors: string[];
}

/**
 * Main compilation pipeline:
 * 1. Find all TypeScript contract files
 * 2. Parse each file into a SkittlesContract IR
 * 3. Generate Solidity source from each contract
 * 4. Compile Solidity to ABI + bytecode via solc
 * 5. Write build artifacts to output directory
 */
export async function compile(
  projectRoot: string,
  config: Required<SkittlesConfig>
): Promise<CompilationResult> {
  const contractsDir = path.join(projectRoot, config.contractsDir);
  const outputDir = path.join(projectRoot, config.outputDir);

  const artifacts: BuildArtifact[] = [];
  const errors: string[] = [];

  // Step 1: Find source files
  const sourceFiles = findTypeScriptFiles(contractsDir);
  if (sourceFiles.length === 0) {
    logInfo("No TypeScript contract files found.");
    return { success: true, artifacts, errors };
  }

  logInfo(`Found ${sourceFiles.length} contract file(s)`);

  // Pre-scan all files to collect shared types (interfaces/structs, enums).
  // This allows contracts in one file to reference types defined in another.
  const globalStructs: Map<string, SkittlesParameter[]> = new Map();
  const globalEnums: Map<string, string[]> = new Map();

  for (const filePath of sourceFiles) {
    try {
      const source = readFile(filePath);
      const { structs, enums } = collectTypes(source, filePath);
      for (const [name, fields] of structs) globalStructs.set(name, fields);
      for (const [name, members] of enums) globalEnums.set(name, members);
    } catch {
      // Errors will be caught in the main compilation loop below
    }
  }

  const externalTypes = { structs: globalStructs, enums: globalEnums };

  for (const filePath of sourceFiles) {
    const relativePath = path.relative(projectRoot, filePath);
    logInfo(`Compiling ${relativePath}...`);

    try {
      // Step 2: Parse TypeScript into SkittlesContract IR
      const source = readFile(filePath);
      const contracts: SkittlesContract[] = parse(source, filePath, externalTypes);

      // Step 3: Generate Solidity (combine all contracts from same file)
      const solidity =
        contracts.length > 1
          ? generateSolidityFile(contracts)
          : contracts.length === 1
            ? generateSolidity(contracts[0])
            : "";

      if (!solidity) continue;

      for (const contract of contracts) {
        // Step 4: Compile Solidity via solc
        const compiled = compileSolidity(contract.name, solidity, config);

        for (const warning of compiled.warnings) {
          logWarning(warning);
        }

        if (compiled.errors.length > 0) {
          errors.push(...compiled.errors);
          continue;
        }

        const artifact: BuildArtifact = {
          contractName: contract.name,
          abi: compiled.abi,
          bytecode: compiled.bytecode,
          solidity,
        };
        artifacts.push(artifact);

        // Step 5: Write artifacts
        writeFile(
          path.join(outputDir, "abi", `${contract.name}.json`),
          JSON.stringify(compiled.abi, null, 2)
        );
        writeFile(
          path.join(outputDir, "bytecode", `${contract.name}.bin`),
          compiled.bytecode
        );
        writeFile(
          path.join(outputDir, "solidity", `${contract.name}.sol`),
          solidity
        );

        logSuccess(`${contract.name} compiled successfully`);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      errors.push(`${relativePath}: ${message}`);
      logError(`Failed to compile ${relativePath}: ${message}`);
    }
  }

  return {
    success: errors.length === 0,
    artifacts,
    errors,
  };
}
