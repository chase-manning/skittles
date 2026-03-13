import type {
  Expression,
  SkittlesContractInterface,
  SkittlesFunction,
  SkittlesParameter,
} from "../../types/index.ts";
import { logWarning } from "../../utils/console.ts";
import { getErrorMessage } from "../../utils/error.ts";
import { readFile } from "../../utils/file.ts";
import {
  collectClassNames,
  collectFunctions,
  collectTypes,
} from "../parser.ts";
import { ctx } from "../parser-context.ts";
import { baseName } from "./cache.ts";

export interface PreScanState {
  globalStructs: Map<string, SkittlesParameter[]>;
  globalEnums: Map<string, string[]>;
  globalContractInterfaces: Map<string, SkittlesContractInterface>;
  globalFunctions: SkittlesFunction[];
  globalConstants: Map<string, Expression>;
  interfaceOriginFile: Map<string, string>;
  contractOriginFile: Map<string, string>;
  preScanContractFiles: string[];
}

/**
 * Pre-scan a list of contract files to collect shared types (type alias
 * structs, contract interfaces, enums), file-level functions, and
 * file-level constants. This allows contracts in one file to reference
 * things defined in another. Also tracks which file defines each
 * interface and class for cross-file imports.
 *
 * Optionally stores read sources into `sourcesOut` for later reuse.
 */
export function preScanContracts(
  files: string[],
  state: PreScanState,
  sourcesOut?: Map<string, string>
): void {
  for (const filePath of files) {
    try {
      const source = readFile(filePath);
      if (sourcesOut) sourcesOut.set(filePath, source);
      const { structs, enums, contractInterfaces } = collectTypes(
        source,
        filePath
      );
      const base = baseName(filePath);
      for (const [name, fields] of structs)
        state.globalStructs.set(name, fields);
      for (const [name, members] of enums)
        state.globalEnums.set(name, members);
      for (const [name, iface] of contractInterfaces) {
        const existingOrigin = state.interfaceOriginFile.get(name);
        if (!existingOrigin || base < existingOrigin) {
          state.globalContractInterfaces.set(name, iface);
          state.interfaceOriginFile.set(name, base);
        }
      }

      // Seed the parser context with types collected so far (from this file
      // and previously scanned files) so that standalone functions referencing
      // imported enum/struct types can be parsed without spurious errors.
      ctx.knownStructs = new Map(state.globalStructs);
      ctx.knownEnums = new Map(state.globalEnums);

      const { functions, constants } = collectFunctions(source, filePath);
      for (const fn of functions) {
        if (!state.globalFunctions.some((f) => f.name === fn.name)) {
          state.globalFunctions.push(fn);
        }
      }
      for (const [name, expr] of constants)
        state.globalConstants.set(name, expr);

      const classNames = collectClassNames(source, filePath);
      for (const className of classNames) {
        const existingOrigin = state.contractOriginFile.get(className);
        if (!existingOrigin || base < existingOrigin) {
          state.contractOriginFile.set(className, base);
        }
      }
      if (classNames.length > 0) {
        state.preScanContractFiles.push(base);
      }
    } catch (err) {
      // Pre-scan failed; will be re-reported during full compilation
      logWarning(
        `Pre-scan failed for ${filePath}: ${getErrorMessage(err, String(err))}`
      );
    }
  }
}
