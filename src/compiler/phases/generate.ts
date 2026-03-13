import path from "path";

import { DEFAULT_CONFIG } from "../../config/defaults.ts";
import type {
  BuildArtifact,
  FormattingConfig,
  SkittlesConfig,
  SkittlesContractInterface,
  Statement,
} from "../../types/index.ts";
import { logError,logInfo, logSuccess } from "../../utils/console.ts";
import { getErrorMessage } from "../../utils/error.ts";
import { writeFile } from "../../utils/file.ts";
import {
  buildSourceMap,
  generateSolidity,
  generateSolidityFile,
} from "../codegen.ts";
import { formatSolidity } from "../formatter.ts";
import { filterStatements } from "../walker.ts";
import type { CacheEntry, CompilationCache } from "./cache.ts";
import { baseName } from "./cache.ts";
import type { CachedFile,ParsedFile } from "./parse-phase.ts";

/**
 * Recursively remove console-log statements from an IR statement list.
 * Uses the shared filterStatements walker from walker.ts.
 * Used when the consoleLog config option is disabled (production builds).
 */
function stripConsoleLogStatements(stmts: Statement[]): Statement[] {
  return filterStatements(stmts, (stmt) => stmt.kind === "console-log");
}

/**
 * Resolve interface mutabilities, emit cached files, and generate
 * Solidity source for freshly parsed contracts.
 */
export function generateOutput(
  parsedFiles: ParsedFile[],
  cachedFiles: CachedFile[],
  globalContractInterfaces: Map<string, SkittlesContractInterface>,
  interfaceOriginFile: Map<string, string>,
  contractOriginFile: Map<string, string>,
  filesWithContracts: Set<string>,
  sharedHash: string,
  configHash: string,
  config: Required<SkittlesConfig>,
  outputDir: string,
  artifacts: BuildArtifact[],
  errors: string[],
  failedFiles: Set<string>,
  newCache: CompilationCache
): void {
  // Resolve interface mutabilities from implementing contracts
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
          const globalFn = globalIface.functions.find(
            (f) => f.name === fn.name
          );
          if (globalFn && !globalFn.stateMutability) {
            globalFn.stateMutability = fn.stateMutability;
          }
        }
      }
    }
  }
  for (const { cached } of cachedFiles) {
    if (!cached.resolvedMutabilities) continue;
    for (const [ifaceName, methods] of Object.entries(
      cached.resolvedMutabilities
    )) {
      const globalIface = globalContractInterfaces.get(ifaceName);
      if (!globalIface) continue;
      for (const [fnName, mut] of Object.entries(methods)) {
        const globalFn = globalIface.functions.find((f) => f.name === fnName);
        if (globalFn && !globalFn.stateMutability) {
          globalFn.stateMutability = mut as
            | "pure"
            | "view"
            | "nonpayable"
            | "payable";
        }
      }
    }
  }

  // Emit cached files
  for (const { filePath, relativePath, cached } of cachedFiles) {
    logInfo(`${relativePath} unchanged, using cache`);
    const cachedBaseName = baseName(filePath);
    // For multi-contract files, all entries in cached.contracts share the same
    // solidity (the combined output from generateSolidityFile), so we write
    // the file once using [0]. The loop below iterates all contracts only to
    // collect individual artifact entries and log each contract name.
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

  // Generate Solidity for parsed files, with imports for external interfaces
  for (const {
    filePath,
    relativePath,
    fileHash,
    depsHash,
    contracts,
  } of parsedFiles) {
    try {
      const base = baseName(filePath);

      // Determine which interfaces should be imported from other .sol files
      const imports: string[] = [];
      const importedIfaceNames = new Set<string>();
      for (const contract of contracts) {
        for (const iface of contract.contractInterfaces) {
          const originBase = interfaceOriginFile.get(iface.name);
          if (
            originBase &&
            originBase !== base &&
            filesWithContracts.has(originBase)
          ) {
            if (!importedIfaceNames.has(iface.name)) {
              importedIfaceNames.add(iface.name);
              imports.push(`./${originBase}.sol`);
            }
          }
        }

        // Import parent contracts defined in other files
        for (const parentName of contract.inherits) {
          const originBase = contractOriginFile.get(parentName);
          if (
            originBase &&
            originBase !== base &&
            filesWithContracts.has(originBase)
          ) {
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
              if (!resolvedMutabilities[iface.name])
                resolvedMutabilities[iface.name] = {};
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
            const globalFn = globalIface.functions.find(
              (f) => f.name === fn.name
            );
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

      const rawSolidity =
        contracts.length > 1
          ? generateSolidityFile(contracts, uniqueImports, config.solidity)
          : contracts.length === 1
            ? generateSolidity(contracts[0], uniqueImports, config.solidity)
            : "";

      if (!rawSolidity) continue;

      const formatting = config.formatting ?? DEFAULT_CONFIG.formatting;
      const solidity = formatSolidity(
        rawSolidity,
        formatting as Required<FormattingConfig>
      );

      // Build source map linking generated Solidity lines to TypeScript source
      const sourceMap = buildSourceMap(solidity, contracts, relativePath);
      writeFile(
        path.join(outputDir, "solidity", `${base}.sol.map`),
        JSON.stringify(sourceMap, null, 2)
      );

      const contractFns: Record<string, Record<string, string>> = {};
      const contractInheritsMap: Record<string, string[]> = {};
      for (const contract of contracts) {
        const fns: Record<string, string> = {};
        for (const fn of contract.functions) fns[fn.name] = fn.stateMutability;
        contractFns[contract.name] = fns;
        contractInheritsMap[contract.name] = contract.inherits;
      }

      const cacheEntry: CacheEntry = {
        fileHash,
        sharedHash,
        depsHash,
        configHash,
        contracts: [],
        resolvedMutabilities,
        contractFunctions: contractFns,
        contractInherits: contractInheritsMap,
      };
      writeFile(path.join(outputDir, "solidity", `${base}.sol`), solidity);

      for (const contract of contracts) {
        artifacts.push({ contractName: contract.name, solidity, sourceMap });
        cacheEntry.contracts.push({ name: contract.name, solidity });
        logSuccess(`${contract.name} compiled successfully`);
      }

      newCache.files[relativePath] = cacheEntry;
    } catch (err) {
      const message = getErrorMessage(err);
      errors.push(`${relativePath}: ${message}`);
      failedFiles.add(relativePath);
      logError(`${relativePath}: ${message}`);
    }
  }
}
