import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type {
  SkittlesConfig,
  SkittlesContract,
  BuildArtifact,
} from "../types/index.ts";
import { findTypeScriptFiles, readFile, writeFile } from "../utils/file.ts";
import { logInfo, logSuccess, logError, logWarning } from "../utils/console.ts";
import { parse, collectTypes, collectFunctions, collectClassNames } from "./parser.ts";
import type { SkittlesParameter, SkittlesFunction, SkittlesConstructor, SkittlesContractInterface, Expression, Statement } from "../types/index.ts";
import { generateSolidity, generateSolidityFile, buildSourceMap } from "./codegen.ts";
import { analyzeFunction } from "./analysis.ts";

export interface CompilationResult {
  success: boolean;
  artifacts: BuildArtifact[];
  errors: string[];
  warnings: string[];
}

// ============================================================
// Incremental compilation cache
// ============================================================

const CACHE_VERSION = "4";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_VERSION: string = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf-8")
).version;

interface CacheEntry {
  fileHash: string;
  sharedHash: string;
  contracts: {
    name: string;
    solidity: string;
  }[];
  resolvedMutabilities?: Record<string, Record<string, string>>;
}

interface CompilationCache {
  version: string;
  skittlesVersion: string;
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
      if (data.version === CACHE_VERSION && data.skittlesVersion === PACKAGE_VERSION) return data;
    }
  } catch {
    // Corrupt cache, start fresh
  }
  return { version: CACHE_VERSION, skittlesVersion: PACKAGE_VERSION, files: {} };
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
 * 4. Write Solidity to artifacts/solidity (Hardhat compiles to ABI + bytecode)
 */
export async function compile(
  projectRoot: string,
  config: Required<SkittlesConfig>
): Promise<CompilationResult> {
  const contractsDir = path.join(projectRoot, config.contractsDir);
  const outputDir = path.join(projectRoot, config.outputDir);
  const cacheDir = path.join(projectRoot, config.cacheDir);

  const artifacts: BuildArtifact[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Step 1: Find source files
  const sourceFiles = findTypeScriptFiles(contractsDir);
  if (sourceFiles.length === 0) {
    logInfo("No TypeScript contract files found.");
    return { success: true, artifacts, errors, warnings: [] };
  }

  logInfo(`Found ${sourceFiles.length} contract file(s)`);

  // Pre-scan all files to collect shared types (type alias structs, contract
  // interfaces, enums), file level functions, and file level constants.
  // This allows contracts in one file to reference things defined in another.
  // Also tracks which file defines each interface for cross-file imports.
  const globalStructs: Map<string, SkittlesParameter[]> = new Map();
  const globalEnums: Map<string, string[]> = new Map();
  const globalContractInterfaces: Map<string, SkittlesContractInterface> = new Map();
  const globalFunctions: SkittlesFunction[] = [];
  const globalConstants: Map<string, Expression> = new Map();
  const interfaceOriginFile = new Map<string, string>();
  const contractOriginFile = new Map<string, string>();
  const preScanContractFiles: string[] = [];

  for (const filePath of sourceFiles) {
    try {
      const source = readFile(filePath);
      const { structs, enums, contractInterfaces } = collectTypes(source, filePath);
      const baseName = path.basename(filePath, path.extname(filePath));
      for (const [name, fields] of structs) globalStructs.set(name, fields);
      for (const [name, members] of enums) globalEnums.set(name, members);
      for (const [name, iface] of contractInterfaces) {
        const existingOrigin = interfaceOriginFile.get(name);
        if (!existingOrigin || baseName < existingOrigin) {
          globalContractInterfaces.set(name, iface);
          interfaceOriginFile.set(name, baseName);
        }
      }

      const { functions, constants } = collectFunctions(source, filePath);
      for (const fn of functions) {
        if (!globalFunctions.some((f) => f.name === fn.name)) {
          globalFunctions.push(fn);
        }
      }
      for (const [name, expr] of constants) globalConstants.set(name, expr);

      const classNames = collectClassNames(source, filePath);
      for (const className of classNames) {
        const existingOrigin = contractOriginFile.get(className);
        if (!existingOrigin || baseName < existingOrigin) {
          contractOriginFile.set(className, baseName);
        }
      }
      if (classNames.length > 0) {
        preScanContractFiles.push(baseName);
      }
    } catch {
      // Errors will be caught in the main compilation loop below
    }
  }

  const externalTypes = { structs: globalStructs, enums: globalEnums, contractInterfaces: globalContractInterfaces };
  const externalFunctions = { functions: globalFunctions, constants: globalConstants };

  // Compute a hash of all shared definitions (types, functions, constants).
  // If any shared definition changes, all files must be recompiled.
  // contractFiles tracks which source files produce .sol output; if a file
  // gains or loses a class declaration the import structure may change, so
  // all caches must be invalidated.
  const sharedDefinitions = {
    structs: Array.from(globalStructs.entries()).sort(([a], [b]) => a.localeCompare(b)),
    enums: Array.from(globalEnums.entries()).sort(([a], [b]) => a.localeCompare(b)),
    contractInterfaces: Array.from(globalContractInterfaces.entries()).sort(([a], [b]) => a.localeCompare(b)),
    functions: [...globalFunctions].sort((a, b) => a.name.localeCompare(b.name)),
    constants: Array.from(globalConstants.entries()).sort(([a], [b]) => a.localeCompare(b)),
    contractFiles: preScanContractFiles.sort(),
  };
  const sharedHash = hashString(JSON.stringify(sharedDefinitions));

  // Load incremental compilation cache
  const cache = loadCache(cacheDir);
  const newCache: CompilationCache = { version: CACHE_VERSION, skittlesVersion: PACKAGE_VERSION, files: {} };

  // Phase 1: Parse all files (needed to resolve cross-file interface mutabilities)
  interface ParsedFile {
    filePath: string;
    relativePath: string;
    source: string;
    fileHash: string;
    contracts: SkittlesContract[];
  }
  const parsedFiles: ParsedFile[] = [];
  const cachedFiles: { filePath: string; relativePath: string; cached: CacheEntry }[] = [];
  const filesWithContracts = new Set<string>();

  for (const filePath of sourceFiles) {
    const relativePath = path.relative(projectRoot, filePath);
    try {
      const source = readFile(filePath);
      const fileHash = hashString(source);
      const cached = cache.files[relativePath];

      if (cached && cached.fileHash === fileHash && cached.sharedHash === sharedHash) {
        cachedFiles.push({ filePath, relativePath, cached });
        if (cached.contracts.length > 0) {
          filesWithContracts.add(path.basename(filePath, path.extname(filePath)));
        }
        continue;
      }

      logInfo(`Compiling ${relativePath}...`);
      const contracts: SkittlesContract[] = parse(source, filePath, externalTypes, externalFunctions);
      if (contracts.length > 0) {
        filesWithContracts.add(path.basename(filePath, path.extname(filePath)));
      }
      parsedFiles.push({ filePath, relativePath, source, fileHash, contracts });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      errors.push(`${relativePath}: ${message}`);
      logError(`Failed to compile ${relativePath}: ${message}`);
    }
  }

  // Analyze parsed contracts for unreachable code and unused variables
  for (const { contracts } of parsedFiles) {
    for (const contract of contracts) {
      const fns: (SkittlesFunction | SkittlesConstructor)[] = [...contract.functions];
      if (contract.ctor) fns.push(contract.ctor);

      for (const fn of fns) {
        for (const w of analyzeFunction(fn, contract.name)) {
          warnings.push(w);
          logWarning(w);
        }
      }
    }
  }

  // Phase 2: Resolve interface mutabilities from implementing contracts
  // and propagate back to the global interface map.
  // Process both freshly parsed files and cached files so that
  // mutabilities are available even when the implementing file is cached.
  for (const { contracts } of parsedFiles) {
    for (const contract of contracts) {
      for (const iface of contract.contractInterfaces) {
        const globalIface = globalContractInterfaces.get(iface.name);
        if (!globalIface) continue;
        for (const fn of iface.functions) {
          if (!fn.stateMutability) continue;
          const globalFn = globalIface.functions.find((f) => f.name === fn.name);
          if (globalFn && !globalFn.stateMutability) {
            globalFn.stateMutability = fn.stateMutability;
          }
        }
      }
    }
  }
  for (const { cached } of cachedFiles) {
    if (!cached.resolvedMutabilities) continue;
    for (const [ifaceName, methods] of Object.entries(cached.resolvedMutabilities)) {
      const globalIface = globalContractInterfaces.get(ifaceName);
      if (!globalIface) continue;
      for (const [fnName, mut] of Object.entries(methods)) {
        const globalFn = globalIface.functions.find((f) => f.name === fnName);
        if (globalFn && !globalFn.stateMutability) {
          globalFn.stateMutability = mut as "pure" | "view" | "nonpayable" | "payable";
        }
      }
    }
  }

  // Phase 3: Emit cached files
  for (const { filePath, relativePath, cached } of cachedFiles) {
    logInfo(`${relativePath} unchanged, using cache`);
    const cachedBaseName = path.basename(filePath, path.extname(filePath));
    writeFile(
      path.join(outputDir, "solidity", `${cachedBaseName}.sol`),
      cached.contracts[0].solidity
    );
    for (const c of cached.contracts) {
      artifacts.push({ contractName: c.name, solidity: c.solidity });
      logSuccess(`${c.name} compiled successfully (cached)`);
    }
    newCache.files[relativePath] = cached;
  }

  // Phase 4: Generate Solidity for parsed files, with imports for external interfaces
  for (const { filePath, relativePath, fileHash, contracts } of parsedFiles) {
    try {
      const baseName = path.basename(filePath, path.extname(filePath));

      // Determine which interfaces should be imported from other .sol files
      const imports: string[] = [];
      const importedIfaceNames = new Set<string>();
      for (const contract of contracts) {
        for (const iface of contract.contractInterfaces) {
          const originBase = interfaceOriginFile.get(iface.name);
          if (originBase && originBase !== baseName && filesWithContracts.has(originBase)) {
            if (!importedIfaceNames.has(iface.name)) {
              importedIfaceNames.add(iface.name);
              imports.push(`./${originBase}.sol`);
            }
          }
        }

        // Import parent contracts defined in other files
        for (const parentName of contract.inherits) {
          const originBase = contractOriginFile.get(parentName);
          if (originBase && originBase !== baseName && filesWithContracts.has(originBase)) {
            imports.push(`./${originBase}.sol`);
          }
        }
      }

      // Snapshot resolved interface mutabilities before imports strip them.
      // Cached files need this to propagate mutabilities in future compiles.
      const resolvedMutabilities: Record<string, Record<string, string>> = {};
      for (const contract of contracts) {
        for (const iface of contract.contractInterfaces) {
          for (const fn of iface.functions) {
            if (fn.stateMutability) {
              if (!resolvedMutabilities[iface.name]) resolvedMutabilities[iface.name] = {};
              resolvedMutabilities[iface.name][fn.name] = fn.stateMutability;
            }
          }
        }
      }

      // Remove imported interfaces from inline declarations
      for (const contract of contracts) {
        contract.contractInterfaces = contract.contractInterfaces.filter(
          (iface) => !importedIfaceNames.has(iface.name)
        );
      }

      // Update remaining inline interface mutabilities from the resolved global map
      for (const contract of contracts) {
        for (const iface of contract.contractInterfaces) {
          const globalIface = globalContractInterfaces.get(iface.name);
          if (!globalIface) continue;
          for (const fn of iface.functions) {
            if (fn.stateMutability) continue;
            const globalFn = globalIface.functions.find((f) => f.name === fn.name);
            if (globalFn?.stateMutability) {
              fn.stateMutability = globalFn.stateMutability;
            }
          }
        }
      }

      // Deduplicate imports
      const uniqueImports = [...new Set(imports)];

      // Strip console.log statements when consoleLog is disabled
      if (!config.consoleLog) {
        for (const contract of contracts) {
          for (const fn of contract.functions) {
            fn.body = stripConsoleLogStatements(fn.body);
          }
          if (contract.ctor) {
            contract.ctor.body = stripConsoleLogStatements(contract.ctor.body);
          }
        }
      }

      const solidity =
        contracts.length > 1
          ? generateSolidityFile(contracts, uniqueImports)
          : contracts.length === 1
            ? generateSolidity(contracts[0], uniqueImports)
            : "";

      if (!solidity) continue;

      // Build source map linking generated Solidity lines to TypeScript source
      const sourceMap = buildSourceMap(solidity, contracts, relativePath);
      writeFile(
        path.join(outputDir, "solidity", `${baseName}.sol.map`),
        JSON.stringify(sourceMap, null, 2)
      );

      const cacheEntry: CacheEntry = { fileHash, sharedHash, contracts: [], resolvedMutabilities };
      writeFile(path.join(outputDir, "solidity", `${baseName}.sol`), solidity);

      for (const contract of contracts) {
        artifacts.push({ contractName: contract.name, solidity, sourceMap });
        cacheEntry.contracts.push({ name: contract.name, solidity });
        logSuccess(`${contract.name} compiled successfully`);
      }

      newCache.files[relativePath] = cacheEntry;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      errors.push(`${relativePath}: ${message}`);
      logError(`Failed to compile ${relativePath}: ${message}`);
    }
  }

  // Save updated cache
  try {
    saveCache(cacheDir, newCache);
  } catch {
    // Non critical if cache save fails
  }

  return {
    success: errors.length === 0,
    artifacts,
    errors,
    warnings,
  };
}

/**
 * Recursively remove console-log statements from an IR statement list.
 * Used when the consoleLog config option is disabled (production builds).
 */
function stripConsoleLogStatements(stmts: Statement[]): Statement[] {
  return stmts.reduce<Statement[]>((acc, stmt) => {
    if (stmt.kind === "console-log") return acc;
    if (stmt.kind === "if") {
      acc.push({
        ...stmt,
        thenBody: stripConsoleLogStatements(stmt.thenBody),
        elseBody: stmt.elseBody ? stripConsoleLogStatements(stmt.elseBody) : undefined,
      });
    } else if (stmt.kind === "for" || stmt.kind === "while" || stmt.kind === "do-while") {
      acc.push({ ...stmt, body: stripConsoleLogStatements(stmt.body) });
    } else if (stmt.kind === "switch") {
      acc.push({
        ...stmt,
        cases: stmt.cases.map((c) => ({ ...c, body: stripConsoleLogStatements(c.body) })),
      });
    } else if (stmt.kind === "try-catch") {
      acc.push({
        ...stmt,
        successBody: stripConsoleLogStatements(stmt.successBody),
        catchBody: stripConsoleLogStatements(stmt.catchBody),
      });
    } else {
      acc.push(stmt);
    }
    return acc;
  }, []);
}
