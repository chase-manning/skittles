import crypto from "crypto";
import fs from "fs";
import path from "path";
import type {
  SkittlesConfig,
  SkittlesContract,
  BuildArtifact,
} from "../types/index.ts";
import { findTypeScriptFiles, readFile, writeFile } from "../utils/file.ts";
import { logInfo, logSuccess, logError } from "../utils/console.ts";
import { parse, collectTypes, collectFunctions } from "./parser.ts";
import type { SkittlesParameter, SkittlesFunction, Expression } from "../types/index.ts";
import { generateSolidity, generateSolidityFile } from "./codegen.ts";

export interface CompilationResult {
  success: boolean;
  artifacts: BuildArtifact[];
  errors: string[];
}

// ============================================================
// Incremental compilation cache
// ============================================================

const CACHE_VERSION = "2";

interface CacheEntry {
  fileHash: string;
  sharedHash: string;
  contracts: {
    name: string;
    solidity: string;
  }[];
}

interface CompilationCache {
  version: string;
  files: Record<string, CacheEntry>;
}

function hashString(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function loadCache(outputDir: string): CompilationCache {
  const cachePath = path.join(outputDir, ".skittles-cache.json");
  try {
    if (fs.existsSync(cachePath)) {
      const data = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      if (data.version === CACHE_VERSION) return data;
    }
  } catch {
    // Corrupt cache, start fresh
  }
  return { version: CACHE_VERSION, files: {} };
}

function saveCache(outputDir: string, cache: CompilationCache): void {
  const cachePath = path.join(outputDir, ".skittles-cache.json");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache), "utf-8");
}

/**
 * Main compilation pipeline:
 * 1. Find all TypeScript contract files
 * 2. Parse each file into a SkittlesContract IR
 * 3. Generate Solidity source from each contract
 * 4. Write Solidity to build/solidity (Hardhat compiles to ABI + bytecode)
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

  // Pre-scan all files to collect shared types (interfaces/structs, enums),
  // file level functions, and file level constants.
  // This allows contracts in one file to reference things defined in another.
  const globalStructs: Map<string, SkittlesParameter[]> = new Map();
  const globalEnums: Map<string, string[]> = new Map();
  const globalFunctions: SkittlesFunction[] = [];
  const globalConstants: Map<string, Expression> = new Map();

  for (const filePath of sourceFiles) {
    try {
      const source = readFile(filePath);
      const { structs, enums } = collectTypes(source, filePath);
      for (const [name, fields] of structs) globalStructs.set(name, fields);
      for (const [name, members] of enums) globalEnums.set(name, members);

      const { functions, constants } = collectFunctions(source, filePath);
      for (const fn of functions) {
        if (!globalFunctions.some((f) => f.name === fn.name)) {
          globalFunctions.push(fn);
        }
      }
      for (const [name, expr] of constants) globalConstants.set(name, expr);
    } catch {
      // Errors will be caught in the main compilation loop below
    }
  }

  const externalTypes = { structs: globalStructs, enums: globalEnums };
  const externalFunctions = { functions: globalFunctions, constants: globalConstants };

  // Compute a hash of all shared definitions (types, functions, constants).
  // If any shared definition changes, all files must be recompiled.
  // We hash the serialized definitions rather than the full concatenated sources
  // to avoid extra I/O and to prevent over-broad cache invalidation from
  // unrelated changes (e.g. comments, whitespace, class body edits).
  const sharedDefinitions = {
    structs: Array.from(globalStructs.entries()).sort(([a], [b]) => a.localeCompare(b)),
    enums: Array.from(globalEnums.entries()).sort(([a], [b]) => a.localeCompare(b)),
    functions: [...globalFunctions].sort((a, b) => a.name.localeCompare(b.name)),
    constants: Array.from(globalConstants.entries()).sort(([a], [b]) => a.localeCompare(b)),
  };
  const sharedHash = hashString(JSON.stringify(sharedDefinitions));

  // Load incremental compilation cache
  const cache = loadCache(outputDir);
  const newCache: CompilationCache = { version: CACHE_VERSION, files: {} };

  for (const filePath of sourceFiles) {
    const relativePath = path.relative(projectRoot, filePath);

    try {
      const source = readFile(filePath);
      const fileHash = hashString(source);

      // Check cache: skip compilation if file and shared defs unchanged
      const cached = cache.files[relativePath];
      if (cached && cached.fileHash === fileHash && cached.sharedHash === sharedHash) {
        logInfo(`${relativePath} unchanged, using cache`);

        const cachedBaseName = path.basename(filePath, path.extname(filePath));
        writeFile(
          path.join(outputDir, "solidity", `${cachedBaseName}.sol`),
          cached.contracts[0].solidity
        );

        for (const c of cached.contracts) {
          const artifact: BuildArtifact = {
            contractName: c.name,
            solidity: c.solidity,
          };
          artifacts.push(artifact);
          logSuccess(`${c.name} compiled successfully (cached)`);
        }

        newCache.files[relativePath] = cached;
        continue;
      }

      logInfo(`Compiling ${relativePath}...`);

      // Step 2: Parse TypeScript into SkittlesContract IR
      const contracts: SkittlesContract[] = parse(source, filePath, externalTypes, externalFunctions);

      // Step 3: Generate Solidity (combine all contracts from same file)
      const solidity =
        contracts.length > 1
          ? generateSolidityFile(contracts)
          : contracts.length === 1
            ? generateSolidity(contracts[0])
            : "";

      if (!solidity) continue;

      const cacheEntry: CacheEntry = { fileHash, sharedHash, contracts: [] };

      const sourceBaseName = path.basename(filePath, path.extname(filePath));
      writeFile(
        path.join(outputDir, "solidity", `${sourceBaseName}.sol`),
        solidity
      );

      for (const contract of contracts) {
        const artifact: BuildArtifact = {
          contractName: contract.name,
          solidity,
        };
        artifacts.push(artifact);
        cacheEntry.contracts.push({ name: contract.name, solidity });
        logSuccess(`${contract.name} compiled successfully`);
      }

      newCache.files[relativePath] = cacheEntry;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      errors.push(`${relativePath}: ${message}`);
      logError(`Failed to compile ${relativePath}: ${message}`);
    }
  }

  // Save updated cache
  try {
    saveCache(outputDir, newCache);
  } catch {
    // Non critical if cache save fails
  }

  return {
    success: errors.length === 0,
    artifacts,
    errors,
  };
}
