import type {
  SkittlesContract,
  SkittlesFunction,
  SourceMapping,
  Statement,
} from "../../types/index.ts";
import { hasAncestorOrigin } from "./helpers.ts";
import { generateStatement, isRequirePattern } from "./statements.ts";
import { generateType } from "./expressions.ts";
// expandDefaultParamOverloads is imported from the main codegen module.
// This creates a safe circular dependency: codegen.ts re-exports buildSourceMap
// from this module, and this module imports expandDefaultParamOverloads from
// codegen.ts. Since all imported symbols are used only at function-call time
// (not during module initialization), this works correctly with ESM live bindings.
import { expandDefaultParamOverloads } from "../codegen.ts";

/**
 * Compute the transitive set of ancestor contract names for the given contract
 * using a BFS traversal over `inherits`.
 */
export function computeAncestors(
  contract: SkittlesContract,
  contractByName: Map<string, SkittlesContract>
): Set<string> {
  const ancestors = new Set<string>();
  const queue = [...contract.inherits.filter((n) => contractByName.has(n))];
  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const name = queue[queueIndex++]!;
    if (ancestors.has(name)) continue;
    ancestors.add(name);
    const parent = contractByName.get(name);
    if (parent) {
      for (const gp of parent.inherits) {
        if (contractByName.has(gp)) queue.push(gp);
      }
    }
  }
  return ancestors;
}

export const getFunctionKey = (f: SkittlesFunction): string => {
  const paramTypes = f.parameters
    .map((p) => (p.type ? generateType(p.type) : "unknown"))
    .join(",");
  return `${f.name}(${paramTypes})`;
};

// ============================================================
// Source map generation
// ============================================================

/**
 * Build a source map that maps generated Solidity line numbers
 * back to TypeScript source line numbers.
 *
 * The mapping is built by walking the IR (which has source line info
 * from the parser) and counting lines in the generated Solidity output
 * to correlate each Solidity line with its TypeScript origin.
 */
export function buildSourceMap(
  solidity: string,
  contracts: SkittlesContract[],
  sourceFile: string
): SourceMapping {
  const solLines = solidity.split("\n");
  const mappings: Record<number, number> = {};

  let lineIdx = 0; // 0-based index into solLines

  // Helper: find the next line matching a test, starting from lineIdx
  function findLine(test: (line: string) => boolean): number {
    for (let i = lineIdx; i < solLines.length; i++) {
      if (test(solLines[i])) {
        lineIdx = i;
        return i;
      }
    }
    return -1;
  }

  function addMapping(solLineIdx: number, tsLine: number | undefined): void {
    if (tsLine !== undefined && solLineIdx >= 0) {
      mappings[solLineIdx + 1] = tsLine; // convert to 1-based
    }
  }

  /**
   * Map function/constructor body statements to Solidity lines.
   * Walks statements in order, using generateStatement to count lines
   * for each statement so we know exactly where each one appears.
   */
  function mapBodyStatements(
    body: Statement[],
    startLineIdx: number,
    indent: string
  ): void {
    let currentIdx = startLineIdx;
    for (const stmt of body) {
      addMapping(currentIdx, stmt.sourceLine);
      const stmtText = generateStatement(stmt, indent);
      const stmtLineCount = stmtText.split("\n").length;

      // Recurse into compound statement bodies
      if (stmt.kind === "if" && !isRequirePattern(stmt)) {
        // Line 0: if (cond) {
        mapBodyStatements(stmt.thenBody, currentIdx + 1, indent + "    ");
        if (stmt.elseBody) {
          const thenLineCount = stmt.thenBody.reduce(
            (sum, s) =>
              sum + generateStatement(s, indent + "    ").split("\n").length,
            0
          );
          // } else { is at currentIdx + 1 + thenLineCount
          mapBodyStatements(
            stmt.elseBody,
            currentIdx + 1 + thenLineCount + 1,
            indent + "    "
          );
        }
      } else if (
        stmt.kind === "expression" &&
        stmt.expression.kind === "conditional" &&
        indent
      ) {
        // Lowered void ternary: map all generated lines to the original source line
        for (let i = 1; i < stmtLineCount; i++) {
          addMapping(currentIdx + i, stmt.sourceLine);
        }
      } else if (stmt.kind === "for" || stmt.kind === "while") {
        mapBodyStatements(stmt.body, currentIdx + 1, indent + "    ");
      } else if (stmt.kind === "do-while") {
        mapBodyStatements(stmt.body, currentIdx + 1, indent + "    ");
      }

      currentIdx += stmtLineCount;
    }
  }

  // Replicate the same ancestor-origin suppression used during codegen so we
  // only try to map functions that were actually emitted in the Solidity output.
  const contractByName = new Map(contracts.map((c) => [c.name, c] as const));
  const smAncestorsMap = new Map<string, Set<string>>();
  for (const c of contracts) {
    smAncestorsMap.set(c.name, computeAncestors(c, contractByName));
  }
  const smFunctionOrigins = new Map<string, Set<string>>();

  for (const contract of contracts) {
    const smAncestors = smAncestorsMap.get(contract.name) ?? new Set<string>();

    const functionsToMap = contract.functions.filter((f) => {
      const key = getFunctionKey(f);
      return !hasAncestorOrigin(smFunctionOrigins.get(key), smAncestors) || f.isOverride;
    });
    for (const f of functionsToMap) {
      const key = getFunctionKey(f);
      let origins = smFunctionOrigins.get(key);
      if (!origins) {
        origins = new Set<string>();
        smFunctionOrigins.set(key, origins);
      }
      origins.add(contract.name);
    }

    // Find the contract declaration line
    const contractIdx = findLine((l) => {
      const trimmed = l.trimStart();
      return (
        trimmed.startsWith(`contract ${contract.name}`) ||
        trimmed.startsWith(`abstract contract ${contract.name}`)
      );
    });
    if (contractIdx === -1) continue;
    addMapping(contractIdx, contract.sourceLine);
    lineIdx = contractIdx + 1;

    // Map events
    for (const e of contract.events) {
      const idx = findLine((l) => {
        const trimmed = l.trim();
        return trimmed.startsWith(`event ${e.name}(`);
      });
      if (idx !== -1) {
        addMapping(idx, e.sourceLine);
        lineIdx = idx + 1;
      }
    }

    // Map variables
    for (const v of contract.variables) {
      const idx = findLine((l) => {
        const trimmed = l.trim();
        return trimmed.includes(` ${v.name}`) && trimmed.endsWith(";");
      });
      if (idx !== -1) {
        addMapping(idx, v.sourceLine);
        lineIdx = idx + 1;
      }
    }

    // Map constructor
    if (contract.ctor) {
      const ctorIdx = findLine((l) => l.trim().startsWith("constructor("));
      if (ctorIdx !== -1) {
        addMapping(ctorIdx, contract.ctor.sourceLine);
        lineIdx = ctorIdx + 1;
        mapBodyStatements(contract.ctor.body, lineIdx, "        ");
      }
    }

    // Map functions — expand default-param overloads so the source map
    // scanner advances past overload wrapper bodies that appear in the
    // generated Solidity (the same expansion is applied during codegen).
    const expandedFns: SkittlesFunction[] = [];
    for (const f of functionsToMap) {
      expandedFns.push(...expandDefaultParamOverloads(f));
    }
    for (const f of expandedFns) {
      const funcIdx = findLine((l) => {
        const trimmed = l.trim();
        if (f.name === "receive") return trimmed.startsWith("receive()");
        if (f.name === "fallback") return trimmed.startsWith("fallback()");
        return trimmed.startsWith(`function ${f.name}(`);
      });
      if (funcIdx !== -1) {
        addMapping(funcIdx, f.sourceLine);
        lineIdx = funcIdx + 1;
        mapBodyStatements(f.body, lineIdx, "        ");
      }
    }
  }

  return { sourceFile, mappings };
}
