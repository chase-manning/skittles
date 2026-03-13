import type {
  Expression,
  SkittlesConfig,
  SkittlesContractInterface,
  SkittlesFunction,
  SkittlesParameter,
} from "../../types/index.ts";
import { readFile } from "../../utils/file.ts";
import { findExtendsReferences } from "../../utils/regex.ts";
import { baseName,hashString } from "./cache.ts";
import type { PreScanState } from "./prescan.ts";

/**
 * Build maps for dependency-aware cache invalidation. Track which parent
 * classes each file extends (cross-file only) and precompute source hashes
 * so we can detect when parent sources change. Also computes shared and
 * config hashes used for cache invalidation.
 */
export function resolveCompilationOrder(
  sourceFiles: string[],
  userSources: Map<string, string>,
  state: PreScanState,
  config: Required<SkittlesConfig>
): {
  computeDepsHash: (filePath: string) => string;
  sharedHash: string;
  configHash: string;
  externalTypes: {
    structs: Map<string, SkittlesParameter[]>;
    enums: Map<string, string[]>;
    contractInterfaces: Map<string, SkittlesContractInterface>;
  };
  externalFunctions: {
    functions: SkittlesFunction[];
    constants: Map<string, Expression>;
  };
} {
  const allSourceHashes = new Map<string, string>();
  const baseNameToFilePath = new Map<string, string>();
  const fileExtendsParents = new Map<string, string[]>();

  for (const filePath of sourceFiles) {
    const base = baseName(filePath);
    baseNameToFilePath.set(base, filePath);
    const source = userSources.get(filePath) ?? readFile(filePath);
    allSourceHashes.set(filePath, hashString(source));

    const parents: string[] = [];
    for (const name of findExtendsReferences(source)) {
      const parentBase = state.contractOriginFile.get(name);
      if (parentBase && parentBase !== base) {
        parents.push(name);
      }
    }
    fileExtendsParents.set(filePath, parents);
  }

  function computeDepsHash(filePath: string): string {
    const visited = new Set<string>();
    const queue = [filePath];
    const hashes: string[] = [];

    while (queue.length > 0) {
      const current = queue.pop();
      if (!current) break;
      const parents = fileExtendsParents.get(current);
      if (!parents) continue;
      for (const parentName of parents) {
        const parentBase = state.contractOriginFile.get(parentName);
        if (!parentBase) continue;
        const parentPath = baseNameToFilePath.get(parentBase);
        if (!parentPath || visited.has(parentPath)) continue;
        visited.add(parentPath);
        const h = allSourceHashes.get(parentPath);
        if (h) hashes.push(h);
        queue.push(parentPath);
      }
    }

    if (hashes.length === 0) return "";
    hashes.sort();
    return hashString(hashes.join(":"));
  }

  const externalTypes = {
    structs: state.globalStructs,
    enums: state.globalEnums,
    contractInterfaces: state.globalContractInterfaces,
  };
  const externalFunctions = {
    functions: state.globalFunctions,
    constants: state.globalConstants,
  };

  // Compute a hash of all shared definitions (types, functions, constants).
  // If any shared definition changes, all files must be recompiled.
  // contractFiles tracks which source files produce .sol output; if a file
  // gains or loses a class declaration the import structure may change, so
  // all caches must be invalidated.
  const sharedDefinitions = {
    structs: Array.from(state.globalStructs.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    ),
    enums: Array.from(state.globalEnums.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    ),
    contractInterfaces: Array.from(
      state.globalContractInterfaces.entries()
    ).sort(([a], [b]) => a.localeCompare(b)),
    functions: [...state.globalFunctions].sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    constants: Array.from(state.globalConstants.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    ),
    contractFiles: state.preScanContractFiles.sort(),
    contractOrigins: Array.from(state.contractOriginFile.entries()).sort(
      ([a], [b]) => a.localeCompare(b)
    ),
  };
  const sharedHash = hashString(JSON.stringify(sharedDefinitions));

  // Hash output-affecting config so cache is invalidated when settings change
  const configHash = hashString(
    JSON.stringify({
      consoleLog: config.consoleLog,
      solidity: config.solidity,
      formatting: config.formatting,
    })
  );

  return {
    computeDepsHash,
    sharedHash,
    configHash,
    externalTypes,
    externalFunctions,
  };
}
