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
import type { SkittlesParameter, SkittlesFunction, SkittlesConstructor, SkittlesContractInterface, Expression, Statement, StateMutability } from "../types/index.ts";
import { generateSolidity, generateSolidityFile, buildSourceMap } from "./codegen.ts";
import { analyzeFunction } from "./analysis.ts";
import { getStdlibClassNames, resolveStdlibFiles, getStdlibContractsDir } from "../stdlib/resolver.ts";

export interface CompilationResult {
  success: boolean;
  artifacts: BuildArtifact[];
  errors: string[];
  warnings: string[];
}

// ============================================================
// Incremental compilation cache
// ============================================================

const CACHE_VERSION = "5";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_VERSION: string = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf-8")
).version;

interface CacheEntry {
  fileHash: string;
  sharedHash: string;
  depsHash: string;
  configHash: string;
  contracts: {
    name: string;
    solidity: string;
  }[];
  resolvedMutabilities?: Record<string, Record<string, string>>;
  contractFunctions?: Record<string, Record<string, string>>;
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
  const userSourceFiles = findTypeScriptFiles(contractsDir);
  if (userSourceFiles.length === 0) {
    logInfo("No TypeScript contract files found.");
    return { success: true, artifacts, errors, warnings: [] };
  }

  logInfo(`Found ${userSourceFiles.length} contract file(s)`);

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
  const stdlibFileSet = new Set<string>();

  // First pass: pre-scan user files
  const userSources = new Map<string, string>();
  for (const filePath of userSourceFiles) {
    try {
      const source = readFile(filePath);
      userSources.set(filePath, source);
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

  // Detect stdlib contract references: scan user sources for `extends`
  // clauses that reference stdlib classes, then include those files.
  const stdlibClassNames = getStdlibClassNames();
  const referencedStdlib = new Set<string>();
  for (const source of userSources.values()) {
    const matches = source.matchAll(/extends\s+(\w+)/g);
    for (const m of matches) {
      if (stdlibClassNames.has(m[1]) && !contractOriginFile.has(m[1])) {
        referencedStdlib.add(m[1]);
      }
    }
  }

  const stdlibFiles = resolveStdlibFiles(referencedStdlib);
  for (const stdlibPath of stdlibFiles) {
    stdlibFileSet.add(stdlibPath);
  }

  // Pre-scan stdlib files into the global maps
  for (const filePath of stdlibFiles) {
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
      // Errors handled in the main compilation loop
    }
  }

  if (stdlibFiles.length > 0) {
    logInfo(`Including ${stdlibFiles.length} standard library contract(s)`);
  }

  const sourceFiles = [...userSourceFiles, ...stdlibFiles];

  // Build maps for dependency-aware cache invalidation.
  // Track which parent classes each file extends (cross-file only) and
  // precompute source hashes so we can detect when parent sources change.
  const allSourceHashes = new Map<string, string>();
  const baseNameToFilePath = new Map<string, string>();
  const fileExtendsParents = new Map<string, string[]>();

  for (const filePath of sourceFiles) {
    const baseName = path.basename(filePath, path.extname(filePath));
    baseNameToFilePath.set(baseName, filePath);
    const source = userSources.get(filePath) ?? readFile(filePath);
    allSourceHashes.set(filePath, hashString(source));

    const parents: string[] = [];
    const extMatches = source.matchAll(/extends\s+(\w+)/g);
    for (const m of extMatches) {
      const parentBase = contractOriginFile.get(m[1]);
      if (parentBase && parentBase !== baseName) {
        parents.push(m[1]);
      }
    }
    fileExtendsParents.set(filePath, parents);
  }

  function computeDepsHash(filePath: string): string {
    const visited = new Set<string>();
    const queue = [filePath];
    const hashes: string[] = [];

    while (queue.length > 0) {
      const current = queue.pop()!;
      const parents = fileExtendsParents.get(current);
      if (!parents) continue;
      for (const parentName of parents) {
        const parentBase = contractOriginFile.get(parentName);
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
    contractOrigins: Array.from(contractOriginFile.entries()).sort(([a], [b]) => a.localeCompare(b)),
  };
  const sharedHash = hashString(JSON.stringify(sharedDefinitions));

  // Hash output-affecting config so cache is invalidated when settings change
  const configHash = hashString(JSON.stringify({
    consoleLog: config.consoleLog,
    solidity: config.solidity,
  }));

  // Load incremental compilation cache
  const cache = loadCache(cacheDir);
  const newCache: CompilationCache = { version: CACHE_VERSION, skittlesVersion: PACKAGE_VERSION, files: {} };

  // Phase 1: Parse all files (needed to resolve cross-file interface mutabilities)
  interface ParsedFile {
    filePath: string;
    relativePath: string;
    source: string;
    fileHash: string;
    depsHash: string;
    contracts: SkittlesContract[];
  }
  const parsedFiles: ParsedFile[] = [];
  const cachedFiles: { filePath: string; relativePath: string; cached: CacheEntry }[] = [];
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

      if (cached && cached.fileHash === fileHash && cached.sharedHash === sharedHash && cached.depsHash === depsHash && cached.configHash === configHash) {
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
      parsedFiles.push({ filePath, relativePath, source, fileHash, depsHash, contracts });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      errors.push(`${relativePath}: ${message}`);
      logError(`Failed to compile ${relativePath}: ${message}`);
    }
  }

  // Cross-file mutability propagation: when a child contract extends a
  // parent from another file, calls to inherited internal functions (e.g.
  // _mint, _burn) need to propagate the callee's mutability to the caller.
  const allParsedContracts = new Map<string, SkittlesContract>();
  for (const { contracts } of parsedFiles) {
    for (const c of contracts) allParsedContracts.set(c.name, c);
  }

  // Include function mutabilities from cached contracts so that freshly
  // parsed children can propagate mutability from cached parents.
  const cachedFnMutabilities = new Map<string, Map<string, string>>();
  for (const { cached } of cachedFiles) {
    if (!cached.contractFunctions) continue;
    for (const [contractName, fns] of Object.entries(cached.contractFunctions)) {
      cachedFnMutabilities.set(contractName, new Map(Object.entries(fns)));
    }
  }

  for (const { contracts } of parsedFiles) {
    for (const contract of contracts) {
      const parentMutabilities = new Map<string, string>();
      for (const parentName of contract.inherits) {
        const parent = allParsedContracts.get(parentName);
        if (parent) {
          for (const fn of parent.functions) {
            if (!parentMutabilities.has(fn.name)) parentMutabilities.set(fn.name, fn.stateMutability);
          }
        } else {
          const cachedFns = cachedFnMutabilities.get(parentName);
          if (cachedFns) {
            for (const [fnName, mut] of cachedFns) {
              if (!parentMutabilities.has(fnName)) parentMutabilities.set(fnName, mut);
            }
          }
        }
      }
      if (parentMutabilities.size === 0) continue;

      const ownMutabilities = new Map<string, string>();
      for (const fn of contract.functions) ownMutabilities.set(fn.name, fn.stateMutability);
      const allMutabilities = new Map([...parentMutabilities, ...ownMutabilities]);

      let changed = true;
      const rank: Record<string, number> = { pure: 0, view: 1, nonpayable: 2, payable: 3 };
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
  for (const { filePath, relativePath, fileHash, depsHash, contracts } of parsedFiles) {
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
          ? generateSolidityFile(contracts, uniqueImports, config.solidity)
          : contracts.length === 1
            ? generateSolidity(contracts[0], uniqueImports, config.solidity)
            : "";

      if (!solidity) continue;

      // Build source map linking generated Solidity lines to TypeScript source
      const sourceMap = buildSourceMap(solidity, contracts, relativePath);
      writeFile(
        path.join(outputDir, "solidity", `${baseName}.sol.map`),
        JSON.stringify(sourceMap, null, 2)
      );

      const contractFns: Record<string, Record<string, string>> = {};
      for (const contract of contracts) {
        const fns: Record<string, string> = {};
        for (const fn of contract.functions) fns[fn.name] = fn.stateMutability;
        contractFns[contract.name] = fns;
      }

      const cacheEntry: CacheEntry = { fileHash, sharedHash, depsHash, configHash, contracts: [], resolvedMutabilities, contractFunctions: contractFns };
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
 * Collect all `this.foo()` and `super.foo()` call names from a statement tree
 * by walking every expression recursively. Unlike the flat statement walker,
 * this detects calls inside return statements, assignments, conditionals, etc.
 * Returns them separately so callers can resolve `super` calls against
 * parent mutabilities (not child overrides).
 */
function collectThisCallNames(stmts: Statement[]): { thisCalls: string[]; superCalls: string[] } {
  const thisCalls: string[] = [];
  const superCalls: string[] = [];

  function walkExpr(expr: Expression): void {
    switch (expr.kind) {
      case "call":
        if (
          expr.callee.kind === "property-access" &&
          expr.callee.object.kind === "identifier"
        ) {
          if (expr.callee.object.name === "this") {
            thisCalls.push(expr.callee.property);
          } else if (expr.callee.object.name === "super") {
            superCalls.push(expr.callee.property);
          }
        }
        walkExpr(expr.callee);
        expr.args.forEach(walkExpr);
        break;
      case "binary":
        walkExpr(expr.left);
        walkExpr(expr.right);
        break;
      case "unary":
        walkExpr(expr.operand);
        break;
      case "assignment":
        walkExpr(expr.target);
        walkExpr(expr.value);
        break;
      case "property-access":
        walkExpr(expr.object);
        break;
      case "element-access":
        walkExpr(expr.object);
        walkExpr(expr.index);
        break;
      case "conditional":
        walkExpr(expr.condition);
        walkExpr(expr.whenTrue);
        walkExpr(expr.whenFalse);
        break;
      case "new":
        expr.args.forEach(walkExpr);
        break;
      case "object-literal":
        expr.properties.forEach((p) => walkExpr(p.value));
        break;
      case "tuple-literal":
        expr.elements.forEach(walkExpr);
        break;
    }
  }

  function walkStmt(stmt: Statement): void {
    switch (stmt.kind) {
      case "return":
        if (stmt.value) walkExpr(stmt.value);
        break;
      case "variable-declaration":
        if (stmt.initializer) walkExpr(stmt.initializer);
        break;
      case "tuple-destructuring":
        walkExpr(stmt.initializer);
        break;
      case "expression":
        walkExpr(stmt.expression);
        break;
      case "if":
        walkExpr(stmt.condition);
        stmt.thenBody.forEach(walkStmt);
        stmt.elseBody?.forEach(walkStmt);
        break;
      case "for":
        if (stmt.initializer) walkStmt(stmt.initializer);
        if (stmt.condition) walkExpr(stmt.condition);
        if (stmt.incrementor) walkExpr(stmt.incrementor);
        stmt.body.forEach(walkStmt);
        break;
      case "while":
        walkExpr(stmt.condition);
        stmt.body.forEach(walkStmt);
        break;
      case "revert":
        if (stmt.message) walkExpr(stmt.message);
        if (stmt.customErrorArgs) stmt.customErrorArgs.forEach(walkExpr);
        break;
      case "do-while":
        walkExpr(stmt.condition);
        stmt.body.forEach(walkStmt);
        break;
      case "emit":
        stmt.args.forEach(walkExpr);
        break;
      case "switch":
        walkExpr(stmt.discriminant);
        for (const c of stmt.cases) {
          if (c.value) walkExpr(c.value);
          c.body.forEach(walkStmt);
        }
        break;
      case "delete":
        walkExpr(stmt.target);
        break;
      case "try-catch":
        walkExpr(stmt.call);
        stmt.successBody.forEach(walkStmt);
        stmt.catchBody.forEach(walkStmt);
        break;
      case "console-log":
        stmt.args.forEach(walkExpr);
        break;
    }
  }

  stmts.forEach(walkStmt);
  return { thisCalls, superCalls };
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
