import type { BuildArtifact, SkittlesConfig } from "../types/index.ts";
import { logInfo } from "../utils/console.ts";
import {
  cacheDir as resolveCacheDir,
  contractsDir as resolveContractsDir,
  outputDir as resolveOutputDir,
} from "../utils/paths.ts";
import { analyzeContracts } from "./phases/analyze.ts";
import { createNewCache, loadCache, updateCache } from "./phases/cache.ts";
import { discoverFiles } from "./phases/discover.ts";
import { generateOutput } from "./phases/generate.ts";
import { parseContracts } from "./phases/parse-phase.ts";
import type { PreScanState } from "./phases/prescan.ts";
import { resolveCompilationOrder } from "./phases/resolve-order.ts";

export interface CompilationResult {
  success: boolean;
  artifacts: BuildArtifact[];
  errors: string[];
  warnings: string[];
  failedFiles: number;
}

/**
 * Main compilation pipeline:
 * 1. Find all TypeScript contract files
 * 2. Parse each file into a SkittlesContract IR
 * 3. Generate Solidity source from each contract
 * 4. Write Solidity to artifacts/solidity (Hardhat compiles to ABI + bytecode)
 */
export async function compile(
  projectRoot: string,
  config: Required<SkittlesConfig>
): Promise<CompilationResult> {
  const contractsDir = resolveContractsDir(projectRoot, config);
  const outputDir = resolveOutputDir(projectRoot, config);
  const cacheDir = resolveCacheDir(projectRoot, config);

  const artifacts: BuildArtifact[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const failedFiles = new Set<string>();

  // Phase 1: Discover source files (user + stdlib)
  const state: PreScanState = {
    globalStructs: new Map(),
    globalEnums: new Map(),
    globalContractInterfaces: new Map(),
    globalFunctions: [],
    globalConstants: new Map(),
    interfaceOriginFile: new Map(),
    contractOriginFile: new Map(),
    preScanContractFiles: [],
  };
  const userSources = new Map<string, string>();

  const { userSourceFiles, stdlibFiles, stdlibFileSet, sourceFiles } =
    discoverFiles(contractsDir, state, userSources);

  if (userSourceFiles.length === 0) {
    logInfo("No TypeScript contract files found.");
    return { success: true, artifacts, errors, warnings: [], failedFiles: 0 };
  }

  logInfo(`Found ${userSourceFiles.length} contract file(s)`);

  if (stdlibFiles.length > 0) {
    logInfo(`Including ${stdlibFiles.length} standard library contract(s)`);
  }

  // Phase 3: Resolve compilation order (dependency hashes)
  const { computeDepsHash, sharedHash, configHash, externalTypes, externalFunctions } =
    resolveCompilationOrder(sourceFiles, userSources, state, config);

  // Load incremental compilation cache
  const cache = loadCache(cacheDir);
  const newCache = createNewCache();

  // Phase 4: Parse all files
  const { parsedFiles, cachedFiles, filesWithContracts } = parseContracts(
    sourceFiles,
    projectRoot,
    stdlibFileSet,
    cache,
    computeDepsHash,
    sharedHash,
    configHash,
    externalTypes,
    externalFunctions,
    errors,
    failedFiles
  );

  // Phase 5: Analyze contracts (mutability propagation + warnings)
  analyzeContracts(parsedFiles, cachedFiles, warnings);

  // Phase 6: Generate output (codegen + emit)
  generateOutput(
    parsedFiles,
    cachedFiles,
    state.globalContractInterfaces,
    state.interfaceOriginFile,
    state.contractOriginFile,
    filesWithContracts,
    sharedHash,
    configHash,
    config,
    outputDir,
    artifacts,
    errors,
    failedFiles,
    newCache
  );

  // Phase 7: Update incremental build cache
  updateCache(cacheDir, newCache);

  return {
    success: errors.length === 0,
    artifacts,
    errors,
    warnings,
    failedFiles: failedFiles.size,
  };
}
