import ts from "typescript";
import type {
  SkittlesContract,
  SkittlesFunction,
  SkittlesParameter,
  SkittlesType,
  SkittlesTypeKind,
  SkittlesContractInterface,
  Expression,
} from "../types/index.ts";
import { ctx } from "./parser-context.ts";
import type { ParserContext } from "./parser-context.ts";
import { parseTypeLiteralFields, parseType, inferType } from "./type-parser.ts";
import { parseExpression } from "./expression-parser.ts";
import { parseStatement } from "./statement-parser.ts";
import {
  inferStateMutability,
  MUTABILITY_RANK,
  propagateMutability,
  walkStatements,
} from "./mutability.ts";
import {
  parseStandaloneFunction,
  parseStandaloneArrowFunction,
  extendsError,
  parseErrorClass,
  parseInterfaceAsContractInterface,
  parseClass,
} from "./class-parser.ts";

// Re-export public API from sub-modules
export type { ParserContext } from "./parser-context.ts";
export { parseType, inferType } from "./type-parser.ts";
export { parseExpression } from "./expression-parser.ts";
export { parseStatement } from "./statement-parser.ts";
export { inferStateMutability } from "./mutability.ts";

export function collectTypes(source: string, filePath: string): {
  structs: Map<string, SkittlesParameter[]>;
  enums: Map<string, string[]>;
  contractInterfaces: Map<string, SkittlesContractInterface>;
} {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );

  // Reset per-run caches to avoid leaking state from prior parse() calls.
  ctx.stateVarTypes = new Map();
  ctx.currentVarTypes = new Map();
  ctx.currentStringNames = new Set();
  ctx.currentParamTypes = new Map();
  ctx.currentEventNames = new Set();

  const structs: Map<string, SkittlesParameter[]> = new Map();
  const enums: Map<string, string[]> = new Map();
  const contractInterfaces: Map<string, SkittlesContractInterface> = new Map();

  // Temporarily set module registries so parseType can resolve references
  const prevStructs = ctx.knownStructs;
  const prevEnums = ctx.knownEnums;
  const prevInterfaces = ctx.knownContractInterfaces;
  const prevInterfaceMap = ctx.knownContractInterfaceMap;
  ctx.knownStructs = structs;
  ctx.knownEnums = enums;
  ctx.knownContractInterfaces = new Set();
  ctx.knownContractInterfaceMap = new Map();

  // Pass 1: collect structs and enums first so parseType can resolve forward references
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name && ts.isTypeLiteralNode(node.type)) {
      const fields = parseTypeLiteralFields(node.type);
      structs.set(node.name.text, fields);
    }
    if (ts.isEnumDeclaration(node) && node.name) {
      const members = node.members.map((m) =>
        ts.isIdentifier(m.name) ? m.name.text : "Unknown"
      );
      enums.set(node.name.text, members);
    }
  });

  // Pass 2: pre-scan interface names so parseType can resolve forward references
  // between interfaces (e.g. an interface method that returns another interface type)
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name) {
      ctx.knownContractInterfaces.add(node.name.text);
    }
  });

  // Pass 3: parse interfaces (which may reference structs/enums/other interfaces via parseType)
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name) {
      const iface = parseInterfaceAsContractInterface(node);
      contractInterfaces.set(node.name.text, iface);
    }
  });

  ctx.knownStructs = prevStructs;
  ctx.knownEnums = prevEnums;
  ctx.knownContractInterfaces = prevInterfaces;
  ctx.knownContractInterfaceMap = prevInterfaceMap;

  return { structs, enums, contractInterfaces };
}

export interface ExternalTypes {
  structs?: Map<string, SkittlesParameter[]>;
  enums?: Map<string, string[]>;
  contractInterfaces?: Map<string, SkittlesContractInterface>;
}

export interface ExternalFunctions {
  functions?: SkittlesFunction[];
  constants?: Map<string, Expression>;
}

export function parse(
  source: string,
  filePath: string,
  externalTypes?: ExternalTypes,
  externalFunctions?: ExternalFunctions
): SkittlesContract[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );

  ctx.currentSourceFile = sourceFile;
  ctx.arrayMethodCounter = 0;
  ctx.stateVarTypes = new Map();
  ctx.destructureCounter = 0;
  // Reset per-parse caches to avoid leaking state between parse() calls.
  ctx.currentVarTypes = new Map();
  ctx.currentStringNames = new Set();
  ctx.currentParamTypes = new Map();
  ctx.currentEventNames = new Set();

  const structs: Map<string, SkittlesParameter[]> = new Map();
  const enums: Map<string, string[]> = new Map();
  const contractInterfaces: Map<string, SkittlesContractInterface> = new Map();
  const contracts: SkittlesContract[] = [];

  // Seed with externally resolved types (from other files)
  if (externalTypes?.structs) {
    for (const [name, fields] of externalTypes.structs) {
      structs.set(name, fields);
    }
  }
  if (externalTypes?.enums) {
    for (const [name, members] of externalTypes.enums) {
      enums.set(name, members);
    }
  }
  if (externalTypes?.contractInterfaces) {
    for (const [name, iface] of externalTypes.contractInterfaces) {
      contractInterfaces.set(name, iface);
    }
  }

  // First pass: collect structs and enums so they are available when parsing interfaces
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name && ts.isTypeLiteralNode(node.type)) {
      const fields = parseTypeLiteralFields(node.type);
      structs.set(node.name.text, fields);
    }
    if (ts.isEnumDeclaration(node) && node.name) {
      const members = node.members.map((m) =>
        ts.isIdentifier(m.name) ? m.name.text : "Unknown"
      );
      enums.set(node.name.text, members);
    }
  });

  ctx.knownStructs = structs;
  ctx.knownEnums = new Map(enums);

  // Second pass: pre-scan interface names (including externalTypes) so parseType
  // can resolve forward/interface-to-interface references during interface parsing
  ctx.knownContractInterfaces = new Set(contractInterfaces.keys());
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name) {
      ctx.knownContractInterfaces.add(node.name.text);
    }
  });
  ctx.knownContractInterfaceMap = new Map(contractInterfaces);

  // Third pass: parse interfaces (may reference struct/enum types and other interfaces)
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name) {
      const iface = parseInterfaceAsContractInterface(node);
      contractInterfaces.set(node.name.text, iface);
    }
  });

  const customErrors: Map<string, SkittlesParameter[]> = new Map();

  ctx.knownContractInterfaces = new Set(contractInterfaces.keys());
  ctx.knownContractInterfaceMap = new Map(contractInterfaces);
  ctx.knownCustomErrors = new Set();
  ctx.fileConstants = new Map();

  // Collect file level constants (const declarations outside classes)
  const fileConstants: Map<string, Expression> = new Map();
  if (externalFunctions?.constants) {
    for (const [name, expr] of externalFunctions.constants) {
      fileConstants.set(name, expr);
    }
  }

  // Collect file level standalone functions (outside classes)
  const fileFunctions: SkittlesFunction[] = [];
  if (externalFunctions?.functions) {
    fileFunctions.push(...externalFunctions.functions);
  }

  // Empty varTypes for file level parsing (no state variables)
  const emptyVarTypes = new Map<string, SkittlesType>();
  const emptyEventNames = new Set<string>();

  // First pass: collect file level constants so parseExpression can inline them
  // when parsing standalone functions in the second pass
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer && !ts.isArrowFunction(decl.initializer)) {
          fileConstants.set(decl.name.text, parseExpression(decl.initializer));
        }
      }
    }
  });

  // Set module level constant registry so parseExpression can inline them
  ctx.fileConstants = fileConstants;

  // Second pass: collect file level standalone functions (with access to constants)
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      fileFunctions.push(parseStandaloneFunction(node, emptyVarTypes, emptyEventNames));
    }

    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer && ts.isArrowFunction(decl.initializer)) {
          fileFunctions.push(parseStandaloneArrowFunction(decl, emptyVarTypes, emptyEventNames));
        }
      }
    }
  });

  // Third: parse classes (with access to file constants and functions)
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isClassDeclaration(node) && node.name) {
      if (extendsError(node)) {
        const params = parseErrorClass(node);
        customErrors.set(node.name.text, params);
        ctx.knownCustomErrors.add(node.name.text);
      } else {
        contracts.push(parseClass(node, filePath, structs, enums, contractInterfaces, customErrors, fileFunctions, fileConstants));
      }
    }
  });

  // Post-process: infer overrides for abstract method implementations
  const abstractMethodsByContract = new Map<string, Set<string>>();
  for (const contract of contracts) {
    if (contract.isAbstract) {
      const abstractMethods = new Set<string>();
      for (const fn of contract.functions) {
        if (fn.isAbstract) {
          abstractMethods.add(fn.name);
        }
      }
      if (abstractMethods.size > 0) {
        abstractMethodsByContract.set(contract.name, abstractMethods);
      }
    }
  }
  const contractByName = new Map(contracts.map((c) => [c.name, c]));
  for (const contract of contracts) {
    for (const parentName of contract.inherits) {
      const abstractMethods = abstractMethodsByContract.get(parentName);
      if (!abstractMethods) continue;
      for (const fn of contract.functions) {
        if (abstractMethods.has(fn.name) && !fn.isOverride) {
          fn.isOverride = true;
          fn.isVirtual = false;
        }
      }
    }
  }

  // Build transitive descendant map so multi-level inheritance is handled
  // (e.g. abstract A → abstract B extends A → class C extends B)
  const descendantsOf = new Map<string, Set<string>>();
  for (const contract of contracts) {
    for (const parentName of contract.inherits) {
      if (!descendantsOf.has(parentName)) descendantsOf.set(parentName, new Set());
      descendantsOf.get(parentName)!.add(contract.name);
    }
  }
  function getAllDescendants(name: string): Set<string> {
    const result = new Set<string>();
    const queue = [name];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = descendantsOf.get(current);
      if (!children) continue;
      for (const child of children) {
        if (!result.has(child)) {
          result.add(child);
          queue.push(child);
        }
      }
    }
    return result;
  }

  // Propagate state mutability from concrete implementations to abstract declarations
  for (const [parentName] of abstractMethodsByContract) {
    const parent = contractByName.get(parentName);
    if (!parent) continue;
    const descendants = getAllDescendants(parentName);
    for (const abstractFn of parent.functions) {
      if (!abstractFn.isAbstract) continue;
      let inferredRank: number | undefined;
      for (const descName of descendants) {
        const desc = contractByName.get(descName);
        if (!desc) continue;
        const concreteFn = desc.functions.find((f) => f.name === abstractFn.name && !f.isAbstract);
        if (!concreteFn) continue;
        const rank = MUTABILITY_RANK[concreteFn.stateMutability];
        if (inferredRank === undefined || rank > inferredRank) {
          inferredRank = rank;
        }
      }
      if (inferredRank !== undefined && inferredRank < MUTABILITY_RANK[abstractFn.stateMutability]) {
        const rankToMut = ["pure", "view", "nonpayable", "payable"] as const;
        abstractFn.stateMutability = rankToMut[inferredRank];
      }
    }
  }

  // Post-process: propagate state mutability across function calls.
  // When a function calls this.someMethod(), and someMethod is known to
  // be nonpayable/payable (state-modifying), the caller must be at least
  // as permissive. This is critical for inheritance where child functions
  // call parent internal functions like _mint/_burn.
  propagateMutability(contracts);

  return contracts;
}

export function collectFunctions(source: string, filePath: string): {
  functions: SkittlesFunction[];
  constants: Map<string, Expression>;
} {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );

  // Reset per-run caches to avoid leaking state from prior parse() calls.
  ctx.stateVarTypes = new Map();
  ctx.currentVarTypes = new Map();
  ctx.currentStringNames = new Set();
  ctx.currentParamTypes = new Map();
  ctx.currentEventNames = new Set();
  ctx.destructureCounter = 0;

  const functions: SkittlesFunction[] = [];
  const constants: Map<string, Expression> = new Map();
  const emptyVarTypes = new Map<string, SkittlesType>();
  const emptyEventNames = new Set<string>();

  // Reuse the struct/enum/interface registries if they were already populated
  // (e.g. by a prior collectTypes() call), so standalone functions that reference
  // struct/enum/interface types can be parsed correctly.
  // Only reset if they are completely empty (i.e. no prior collectTypes() call).
  const prevStructs = ctx.knownStructs;
  const prevEnums = ctx.knownEnums;
  const prevInterfaces = ctx.knownContractInterfaces;
  const prevInterfaceMap = ctx.knownContractInterfaceMap;

  // Pre-scan the file for type declarations so standalone functions can reference them.
  // If registries are already populated (e.g. by a prior collectTypes()), reuse them;
  // otherwise scan the current file for structs and enums.
  if (ctx.knownStructs.size === 0 || ctx.knownEnums.size === 0) {
    const localStructs = ctx.knownStructs.size > 0 ? ctx.knownStructs : new Map<string, SkittlesParameter[]>();
    const localEnums = ctx.knownEnums.size > 0 ? ctx.knownEnums : new Map<string, string[]>();
    ctx.knownStructs = localStructs;
    ctx.knownEnums = localEnums;
    ctx.knownContractInterfaces = new Set();
    ctx.knownContractInterfaceMap = new Map();

    ts.forEachChild(sourceFile, (node) => {
      if (ts.isTypeAliasDeclaration(node) && node.name && ts.isTypeLiteralNode(node.type)) {
        localStructs.set(node.name.text, parseTypeLiteralFields(node.type));
      }
      if (ts.isEnumDeclaration(node) && node.name) {
        const members = node.members.map((m) =>
          ts.isIdentifier(m.name) ? m.name.text : "Unknown"
        );
        localEnums.set(node.name.text, members);
      }
    });
  }

  // First pass: collect file level constants so parseExpression can inline them
  // when parsing standalone functions in the second pass
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer && !ts.isArrowFunction(decl.initializer)) {
          constants.set(decl.name.text, parseExpression(decl.initializer));
        }
      }
    }
  });

  // Set module level constant registry so parseExpression can inline them
  ctx.fileConstants = constants;

  // Second pass: collect file level standalone functions (with access to constants)
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      functions.push(parseStandaloneFunction(node, emptyVarTypes, emptyEventNames));
    }

    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer && ts.isArrowFunction(decl.initializer)) {
          functions.push(parseStandaloneArrowFunction(decl, emptyVarTypes, emptyEventNames));
        }
      }
    }
  });

  ctx.knownStructs = prevStructs;
  ctx.knownEnums = prevEnums;
  ctx.knownContractInterfaces = prevInterfaces;
  ctx.knownContractInterfaceMap = prevInterfaceMap;

  return { functions, constants };
}

/**
 * Pre-scan a source file to collect the names of all contract classes
 * (top-level class declarations that do not extend Error).
 * Used by the compiler to track which file defines each contract.
 */
export function collectClassNames(source: string, filePath: string): string[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );

  const names: string[] = [];
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isClassDeclaration(node) && node.name && !extendsError(node)) {
      names.push(node.name.text);
    }
  });
  return names;
}
