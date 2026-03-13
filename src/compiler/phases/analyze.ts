import type {
  SkittlesConstructor,
  SkittlesContract,
  SkittlesFunction,
  Statement,
  StateMutability,
} from "../../types/index.ts";
import { logWarning } from "../../utils/console.ts";
import { analyzeFunction } from "../analysis.ts";
import { MUTABILITY_RANK } from "../mutability.ts";
import { walkStatements } from "../walker.ts";
import type { CachedFile,ParsedFile } from "./parse-phase.ts";

/**
 * Collect all `this.foo()` and `super.foo()` call names from a statement tree
 * by walking every expression recursively. Unlike the flat statement walker,
 * this detects calls inside return statements, assignments, conditionals, etc.
 * Returns them separately so callers can resolve `super` calls against
 * parent mutabilities (not child overrides).
 */
function collectThisCallNames(stmts: Statement[]): {
  thisCalls: string[];
  superCalls: string[];
} {
  const thisCalls: string[] = [];
  const superCalls: string[] = [];

  walkStatements(stmts, {
    visitExpression(expr) {
      if (
        expr.kind === "call" &&
        expr.callee.kind === "property-access" &&
        expr.callee.object.kind === "identifier"
      ) {
        if (expr.callee.object.name === "this") {
          thisCalls.push(expr.callee.property);
        } else if (expr.callee.object.name === "super") {
          superCalls.push(expr.callee.property);
        }
      }
    },
  });

  return { thisCalls, superCalls };
}

/**
 * Run analysis passes on parsed contracts: cross-file mutability
 * propagation and detection of unreachable code / unused variables.
 */
export function analyzeContracts(
  parsedFiles: ParsedFile[],
  cachedFiles: CachedFile[],
  warnings: string[]
): void {
  // Cross-file mutability propagation: when a child contract extends a
  // parent from another file, calls to inherited internal functions (e.g.
  // _mint, _burn) need to propagate the callee's mutability to the caller.
  const allParsedContracts = new Map<string, SkittlesContract>();
  for (const { contracts } of parsedFiles) {
    for (const c of contracts) allParsedContracts.set(c.name, c);
  }

  // Include function mutabilities and inheritance info from cached contracts
  // so that freshly parsed children can propagate mutability from cached parents.
  const cachedFnMutabilities = new Map<string, Map<string, string>>();
  const cachedContractInherits = new Map<string, string[]>();
  for (const { cached } of cachedFiles) {
    if (cached.contractFunctions) {
      for (const [contractName, fns] of Object.entries(
        cached.contractFunctions
      )) {
        cachedFnMutabilities.set(contractName, new Map(Object.entries(fns)));
      }
    }
    if (cached.contractInherits) {
      for (const [contractName, parents] of Object.entries(
        cached.contractInherits
      )) {
        cachedContractInherits.set(contractName, parents);
      }
    }
  }

  for (const { contracts } of parsedFiles) {
    for (const contract of contracts) {
      const parentMutabilities = new Map<string, string>();
      // Traverse the full inheritance chain (not just direct parents)
      // so that functions defined in grandparent contracts (e.g. _mint
      // in ERC20 when extending ERC20Votes) are included.
      const visited = new Set<string>();
      const queue = [...contract.inherits];
      while (queue.length > 0) {
        const parentName = queue.pop()!;
        if (visited.has(parentName)) continue;
        visited.add(parentName);
        const parent = allParsedContracts.get(parentName);
        if (parent) {
          for (const fn of parent.functions) {
            if (!parentMutabilities.has(fn.name))
              parentMutabilities.set(fn.name, fn.stateMutability);
          }
          // Continue up the inheritance chain
          for (const grandparent of parent.inherits) {
            if (!visited.has(grandparent)) queue.push(grandparent);
          }
        } else {
          const cachedFns = cachedFnMutabilities.get(parentName);
          if (cachedFns) {
            for (const [fnName, mut] of cachedFns) {
              if (!parentMutabilities.has(fnName))
                parentMutabilities.set(fnName, mut);
            }
          }
          // Continue up the inheritance chain for cached parents
          const cachedParents = cachedContractInherits.get(parentName);
          if (cachedParents) {
            for (const grandparent of cachedParents) {
              if (!visited.has(grandparent)) queue.push(grandparent);
            }
          }
        }
      }
      if (parentMutabilities.size === 0) continue;

      const ownMutabilities = new Map<string, string>();
      for (const fn of contract.functions)
        ownMutabilities.set(fn.name, fn.stateMutability);
      const allMutabilities = new Map([
        ...parentMutabilities,
        ...ownMutabilities,
      ]);

      let changed = true;
      const rank: Record<string, number> = MUTABILITY_RANK;
      while (changed) {
        changed = false;
        for (const fn of contract.functions) {
          const { thisCalls, superCalls } = collectThisCallNames(fn.body);
          for (const name of thisCalls) {
            const calleeMut = allMutabilities.get(name);
            if (!calleeMut) continue;
            if (rank[calleeMut] > rank[fn.stateMutability]) {
              fn.stateMutability = calleeMut as StateMutability;
              allMutabilities.set(fn.name, fn.stateMutability);
              changed = true;
            }
          }
          // super.foo() explicitly invokes the parent implementation, so
          // resolve against parentMutabilities (not allMutabilities which
          // includes child overrides that may have different mutability).
          for (const name of superCalls) {
            const calleeMut = parentMutabilities.get(name);
            if (!calleeMut) continue;
            if (rank[calleeMut] > rank[fn.stateMutability]) {
              fn.stateMutability = calleeMut as StateMutability;
              allMutabilities.set(fn.name, fn.stateMutability);
              changed = true;
            }
          }
        }
      }
    }
  }

  // Analyze parsed contracts for unreachable code and unused variables
  for (const { contracts } of parsedFiles) {
    for (const contract of contracts) {
      const fns: (SkittlesFunction | SkittlesConstructor)[] = [
        ...contract.functions,
      ];
      if (contract.ctor) fns.push(contract.ctor);

      for (const fn of fns) {
        for (const w of analyzeFunction(fn, contract.name)) {
          warnings.push(w);
          logWarning(w);
        }
      }
    }
  }
}
