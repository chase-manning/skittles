import ts from "typescript";

import type {
  Expression,
  SkittlesContractInterface,
  SkittlesFunction,
  SkittlesParameter,
  SkittlesType,
} from "../types/index.ts";

export interface ParserContext {
  // Module-level registries, populated during parse()
  knownStructs: Map<string, SkittlesParameter[]>;
  knownContractInterfaces: Set<string>;
  knownContractInterfaceMap: Map<string, SkittlesContractInterface>;
  knownEnums: Map<string, string[]>;
  knownCustomErrors: Set<string>;
  fileConstants: Map<string, Expression>;
  currentSourceFile: ts.SourceFile | null;

  // String type tracking for string.length and string comparison transforms
  currentVarTypes: Map<string, SkittlesType>;
  currentStringNames: Set<string>;
  currentEventNames: Set<string>;

  // Original state-variable-only type map (never mutated by locals/params).
  // Used for resolving `this.<prop>` in template literals to avoid shadowing issues.
  stateVarTypes: Map<string, SkittlesType>;

  // Array method support: generated helper functions and tracking
  generatedArrayFunctions: SkittlesFunction[];
  arrayMethodCounter: number;
  neededArrayHelpers: Set<string>;

  // Function parameter type tracking (for spread operator type resolution)
  currentParamTypes: Map<string, SkittlesType>;

  // Counter for generating unique struct destructuring temp variable names
  destructureCounter: number;

  // Registry of state variable names per contract (populated during pre-scan).
  // Used for resolving `this.<prop>` across inheritance chains so that
  // property accesses on parent getter methods emit the required `()`.
  contractStateVarNames: Map<string, Set<string>>;

  // Registry of parent class names per contract (populated during pre-scan).
  contractParentNames: Map<string, string[]>;

  // Set of state variable names inherited from parent contracts.
  // Set per-class during parsing; used by the getter rewrite pass.
  parentStateVarNames: Set<string>;
}

export function createParserContext(): ParserContext {
  return {
    knownStructs: new Map(),
    knownContractInterfaces: new Set(),
    knownContractInterfaceMap: new Map(),
    knownEnums: new Map(),
    knownCustomErrors: new Set(),
    fileConstants: new Map(),
    currentSourceFile: null,
    currentVarTypes: new Map(),
    currentStringNames: new Set(),
    currentEventNames: new Set(),
    stateVarTypes: new Map(),
    generatedArrayFunctions: [],
    arrayMethodCounter: 0,
    neededArrayHelpers: new Set(),
    currentParamTypes: new Map(),
    destructureCounter: 0,
    contractStateVarNames: new Map(),
    contractParentNames: new Map(),
    parentStateVarNames: new Set(),
  };
}

export let ctx: ParserContext = createParserContext();

export function resetContext(): void {
  ctx = createParserContext();
}

/**
 * Reset per-run caches to avoid leaking state from prior parse() calls.
 * Called at the start of collectTypes, collectFunctions, and parse.
 */
export function resetContextForParse(): void {
  ctx.stateVarTypes = new Map();
  ctx.currentVarTypes = new Map();
  ctx.currentStringNames = new Set();
  ctx.currentParamTypes = new Map();
  ctx.currentEventNames = new Set();
  ctx.destructureCounter = 0;
}
