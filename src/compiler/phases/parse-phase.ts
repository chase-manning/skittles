import path from "path";

import { getStdlibContractsDir } from "../../stdlib/resolver.ts";
import type {
  Expression,
  SkittlesContract,
  SkittlesContractInterface,
  SkittlesFunction,
  SkittlesParameter,
} from "../../types/index.ts";
import { logError, logInfo } from "../../utils/console.ts";
import { getErrorMessage } from "../../utils/error.ts";
import { readFile } from "../../utils/file.ts";
import { parse } from "../parser.ts";
import type { CacheEntry, CompilationCache } from "./cache.ts";
import { baseName, hashString } from "./cache.ts";

export interface ParsedFile {
  filePath: string;
  relativePath: string;
  source: string;
  fileHash: string;
  depsHash: string;
  contracts: SkittlesContract[];
}

export interface CachedFile {
  filePath: string;
  relativePath: string;
  cached: CacheEntry;
}

/**
 * Parse all contract source files into the intermediate representation,
 * using the incremental compilation cache to skip unchanged files.
 */
export function parseContracts(
  sourceFiles: string[],
  projectRoot: string,
  stdlibFileSet: Set<string>,
  cache: CompilationCache,
  computeDepsHash: (filePath: string) => string,
  sharedHash: string,
  configHash: string,
  externalTypes: {
    structs: Map<string, SkittlesParameter[]>;
    enums: Map<string, string[]>;
    contractInterfaces: Map<string, SkittlesContractInterface>;
  },
  externalFunctions: {
    functions: SkittlesFunction[];
    constants: Map<string, Expression>;
  },
  errors: string[],
  failedFiles: Set<string>
): {
  parsedFiles: ParsedFile[];
  cachedFiles: CachedFile[];
  filesWithContracts: Set<string>;
} {
  const parsedFiles: ParsedFile[] = [];
  const cachedFiles: CachedFile[] = [];
  const filesWithContracts = new Set<string>();

  for (const filePath of sourceFiles) {
    const isStdlib = stdlibFileSet.has(filePath);
    const relativePath = isStdlib
      ? `stdlib/${path.relative(getStdlibContractsDir(), filePath)}`
      : path.relative(projectRoot, filePath);
    try {
      const source = readFile(filePath);
      const fileHash = hashString(source);
      const depsHash = computeDepsHash(filePath);
      const cached = cache.files[relativePath];

      if (
        cached &&
        cached.fileHash === fileHash &&
        cached.sharedHash === sharedHash &&
        cached.depsHash === depsHash &&
        cached.configHash === configHash
      ) {
        cachedFiles.push({ filePath, relativePath, cached });
        if (cached.contracts.length > 0) {
          filesWithContracts.add(baseName(filePath));
        }
        continue;
      }

      logInfo(`Compiling ${relativePath}...`);
      const contracts: SkittlesContract[] = parse(
        source,
        filePath,
        externalTypes,
        externalFunctions
      );
      if (contracts.length > 0) {
        filesWithContracts.add(baseName(filePath));
      }
      parsedFiles.push({
        filePath,
        relativePath,
        source,
        fileHash,
        depsHash,
        contracts,
      });
    } catch (err) {
      const message = getErrorMessage(err);
      errors.push(`${relativePath}: ${message}`);
      failedFiles.add(relativePath);
      logError(`${relativePath}: ${message}`);
    }
  }

  return { parsedFiles, cachedFiles, filesWithContracts };
}
