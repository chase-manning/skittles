import ts from "typescript";

import type {
  CollectedFunctions,
  CollectedTypes,
  Expression,
  SkittlesContract,
  SkittlesContractInterface,
  SkittlesFunction,
  SkittlesParameter,
  SkittlesType,
  SkittlesTypeKind,
} from "../types/index.ts";
import {
  extendsError,
  parseClass,
  parseErrorClass,
  parseInterfaceAsContractInterface,
  parseStandaloneArrowFunction,
  parseStandaloneFunction,
} from "./class-parser.ts";
import { parseExpression } from "./expression-parser.ts";
import {
  inferStateMutability,
  MUTABILITY_RANK,
  propagateMutability,
} from "./mutability.ts";
import type { ParserContext } from "./parser-context.ts";
import { ctx, resetContextForParse } from "./parser-context.ts";
import { getEnumMemberName } from "./parser-utils.ts";
import { parseStatement } from "./statement-parser.ts";
import { inferType, parseType, parseTypeLiteralFields } from "./type-parser.ts";

// Re-export public API from sub-modules
export { parseExpression } from "./expression-parser.ts";
export { inferStateMutability } from "./mutability.ts";
export type { ParserContext } from "./parser-context.ts";
export { parseStatement } from "./statement-parser.ts";
export { inferType,parseType } from "./type-parser.ts";

/**
 * Scan a source file for struct (type alias with type literal) and enum declarations,
 * populating the provided maps in-place so that parseType can resolve references
 * as they are discovered during the traversal.
 *
 * When `interfaceNames` is provided, interface declaration names are also collected
 * in the same traversal, eliminating a separate AST pass.
 */
function collectStructsAndEnums(
  sourceFile: ts.SourceFile,
  structs: Map<string, SkittlesParameter[]>,
  enums: Map<string, string[]>,
  interfaceNames?: Set<string>
): void {
  ts.forEachChild(sourceFile, (node) => {
    if (
      ts.isTypeAliasDeclaration(node) &&
      node.name &&
      ts.isTypeLiteralNode(node.type)
    ) {
      structs.set(node.name.text, parseTypeLiteralFields(node.type));
    }
    if (ts.isEnumDeclaration(node) && node.name) {
      const members = node.members.map((m) => getEnumMemberName(m));
      enums.set(node.name.text, members);
    }
    if (interfaceNames && ts.isInterfaceDeclaration(node) && node.name) {
      interfaceNames.add(node.name.text);
    }
  });
}

export function collectTypes(
  source: string,
  filePath: string
): CollectedTypes {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );

  resetContextForParse();

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

  // ── Pass dependencies for collectTypes ──
  // Pass 1: structs, enums, interface names (no dependencies; collected together)
  // Pass 2: parse interfaces (depends on Pass 1: needs structs/enums for parseType,
  //          needs interface names for forward references between interfaces)

  // Pass 1: collect structs, enums, and interface names in a single traversal
  collectStructsAndEnums(sourceFile, structs, enums, ctx.knownContractInterfaces);

  // Pass 2: parse interfaces (which may reference structs/enums/other interfaces via parseType)
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
  resetContextForParse();
  ctx.contractStateVarNames = new Map();
  ctx.contractParentNames = new Map();
  ctx.parentStateVarNames = new Set();

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

  // ── Pass dependencies for parse() ──
  // Pass 1: structs, enums, interface names (no dependencies; collected together)
  // Pass 2: parse interfaces + collect constants + collect function/class nodes
  //          (interfaces depend on Pass 1 for type resolution;
  //           constants and node collection have no dependencies)
  // Between passes: set ctx.fileConstants, then process collected function nodes
  // Pass 3: parse classes (depends on all above: types, interfaces, constants, functions)

  // Pass 1: collect structs, enums, and interface names in a single traversal
  ctx.knownContractInterfaces = new Set(contractInterfaces.keys());
  collectStructsAndEnums(sourceFile, structs, enums, ctx.knownContractInterfaces);

  ctx.knownStructs = structs;
  ctx.knownEnums = new Map(enums);
  ctx.knownContractInterfaceMap = new Map(contractInterfaces);

  const customErrors: Map<string, SkittlesParameter[]> = new Map();

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

  // Pass 2: parse interfaces, collect constants, and collect function/class nodes
  // in a single traversal. Interfaces are parsed immediately (they depend on Pass 1
  // types only). Constants and function/class nodes are collected for processing
  // after the traversal.
  const collectedFunctionDecls: ts.FunctionDeclaration[] = [];
  const collectedArrowFuncDecls: ts.VariableDeclaration[] = [];
  const collectedClassDecls: ts.ClassDeclaration[] = [];

  // Reset context registries before Pass 2 so parseExpression doesn't see
  // stale constants/errors from a previously parsed file.
  ctx.fileConstants = new Map();
  ctx.knownCustomErrors = new Set();

  ts.forEachChild(sourceFile, (node) => {
    // Parse interfaces (depends on structs/enums from Pass 1)
    if (ts.isInterfaceDeclaration(node) && node.name) {
      const iface = parseInterfaceAsContractInterface(node);
      contractInterfaces.set(node.name.text, iface);
    }

    // Collect file-level constants and function/arrow-function nodes
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          if (ts.isArrowFunction(decl.initializer)) {
            collectedArrowFuncDecls.push(decl);
          } else {
            fileConstants.set(
              decl.name.text,
              parseExpression(decl.initializer)
            );
          }
        }
      }
    }

    // Collect function declarations
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      collectedFunctionDecls.push(node);
    }

    // Collect class declarations
    if (ts.isClassDeclaration(node) && node.name) {
      collectedClassDecls.push(node);
    }
  });

  // Update context registries after Pass 2
  ctx.knownContractInterfaces = new Set(contractInterfaces.keys());
  ctx.knownContractInterfaceMap = new Map(contractInterfaces);
  ctx.knownCustomErrors = new Set();

  // Set module level constant registry so parseExpression can inline them
  ctx.fileConstants = fileConstants;

  // Process collected function nodes (depends on fileConstants being set)
  for (const node of collectedFunctionDecls) {
    fileFunctions.push(
      parseStandaloneFunction(node, emptyVarTypes, emptyEventNames)
    );
  }
  for (const decl of collectedArrowFuncDecls) {
    fileFunctions.push(
      parseStandaloneArrowFunction(decl, emptyVarTypes, emptyEventNames)
    );
  }

  // Pass 3: parse classes (depends on types, interfaces, constants, and functions)
  for (const node of collectedClassDecls) {
    if (extendsError(node)) {
      const params = parseErrorClass(node);
      customErrors.set(node.name!.text, params);
      ctx.knownCustomErrors.add(node.name!.text);
    } else {
      contracts.push(
        parseClass(
          node,
          filePath,
          structs,
          enums,
          contractInterfaces,
          customErrors,
          fileFunctions,
          fileConstants
        )
      );
    }
  }

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
      if (!descendantsOf.has(parentName))
        descendantsOf.set(parentName, new Set());
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
        const concreteFn = desc.functions.find(
          (f) => f.name === abstractFn.name && !f.isAbstract
        );
        if (!concreteFn) continue;
        const rank = MUTABILITY_RANK[concreteFn.stateMutability];
        if (inferredRank === undefined || rank > inferredRank) {
          inferredRank = rank;
        }
      }
      if (
        inferredRank !== undefined &&
        inferredRank < MUTABILITY_RANK[abstractFn.stateMutability]
      ) {
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

export function collectFunctions(
  source: string,
  filePath: string
): CollectedFunctions {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );

  resetContextForParse();

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
    const localStructs =
      ctx.knownStructs.size > 0
        ? ctx.knownStructs
        : new Map<string, SkittlesParameter[]>();
    const localEnums =
      ctx.knownEnums.size > 0 ? ctx.knownEnums : new Map<string, string[]>();
    ctx.knownStructs = localStructs;
    ctx.knownEnums = localEnums;
    ctx.knownContractInterfaces = new Set();
    ctx.knownContractInterfaceMap = new Map();

    collectStructsAndEnums(sourceFile, localStructs, localEnums);
  }

  // ── Pass dependencies for collectFunctions ──
  // Single pass: collect constants + collect function/arrow-function nodes
  //              (no dependencies between them during collection)
  // After pass: set ctx.fileConstants, then process collected function nodes
  //             (function parsing depends on constants for expression inlining)

  // Single pass: collect constants and function/arrow-function nodes together
  const collectedFunctionDecls: ts.FunctionDeclaration[] = [];
  const collectedArrowFuncDecls: ts.VariableDeclaration[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      collectedFunctionDecls.push(node);
    }

    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          if (ts.isArrowFunction(decl.initializer)) {
            collectedArrowFuncDecls.push(decl);
          } else {
            constants.set(decl.name.text, parseExpression(decl.initializer));
          }
        }
      }
    }
  });

  // Set module level constant registry so parseExpression can inline them
  ctx.fileConstants = constants;

  // Process collected function nodes (depends on fileConstants being set)
  for (const node of collectedFunctionDecls) {
    functions.push(
      parseStandaloneFunction(node, emptyVarTypes, emptyEventNames)
    );
  }
  for (const decl of collectedArrowFuncDecls) {
    functions.push(
      parseStandaloneArrowFunction(decl, emptyVarTypes, emptyEventNames)
    );
  }

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
      const className = node.name.text;
      names.push(className);

      // Collect state variable names (property declarations that are not
      // arrow-function methods) for resolving `this.<prop>` across inheritance.
      const stateVarNames = new Set<string>();
      for (const member of node.members) {
        if (ts.isPropertyDeclaration(member) && member.name) {
          // Skip arrow function properties (they become methods)
          if (member.initializer && ts.isArrowFunction(member.initializer))
            continue;
          const propName = ts.isIdentifier(member.name)
            ? member.name.text
            : ts.isPrivateIdentifier(member.name)
              ? member.name.text.replace(/^#/, "")
              : null;
          if (propName) stateVarNames.add(propName);
        }
      }
      ctx.contractStateVarNames.set(className, stateVarNames);

      // Collect parent class names for inheritance chain traversal.
      const parents: string[] = [];
      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
            for (const type of clause.types) {
              if (ts.isIdentifier(type.expression)) {
                parents.push(type.expression.text);
              }
            }
          }
        }
      }
      ctx.contractParentNames.set(className, parents);
    }
  });
  return names;
}
