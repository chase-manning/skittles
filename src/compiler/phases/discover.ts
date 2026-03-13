import { findTypeScriptFiles } from "../../utils/file.ts";
import { findExtendsReferences } from "../../utils/regex.ts";
import {
  getStdlibClassNames,
  resolveStdlibFiles,
} from "../../stdlib/resolver.ts";
import type { PreScanState } from "./prescan.ts";
import { preScanContracts } from "./prescan.ts";

/**
 * Find user contract files in the contracts directory, then detect
 * stdlib references and resolve the required standard library files.
 * Pre-scans all discovered files to populate shared type/function maps.
 */
export function discoverFiles(
  contractsDir: string,
  state: PreScanState,
  userSources: Map<string, string>
): {
  userSourceFiles: string[];
  stdlibFiles: string[];
  stdlibFileSet: Set<string>;
  sourceFiles: string[];
} {
  const userSourceFiles = findTypeScriptFiles(contractsDir);

  // Pre-scan user files
  preScanContracts(userSourceFiles, state, userSources);

  // Detect stdlib contract references: scan user sources for `extends`
  // clauses that reference stdlib classes, then include those files.
  const stdlibClassNames = getStdlibClassNames();
  const referencedStdlib = new Set<string>();
  for (const source of userSources.values()) {
    for (const name of findExtendsReferences(source)) {
      if (stdlibClassNames.has(name) && !state.contractOriginFile.has(name)) {
        referencedStdlib.add(name);
      }
    }
  }

  const stdlibFiles = resolveStdlibFiles(referencedStdlib);
  const stdlibFileSet = new Set<string>(stdlibFiles);

  // Pre-scan stdlib files into the global maps
  preScanContracts(stdlibFiles, state);

  const sourceFiles = [...userSourceFiles, ...stdlibFiles];
  return { userSourceFiles, stdlibFiles, stdlibFileSet, sourceFiles };
}
