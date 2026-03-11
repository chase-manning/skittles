import type {
  SkittlesParameter,
  SkittlesType,
  SkittlesContractInterface,
  SkittlesFunction,
  Expression,
} from "../types/index.ts";
import ts from "typescript";

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
  };
}

export let ctx: ParserContext = createParserContext();

export function resetContext(): void {
  ctx = createParserContext();
}
