export interface CodegenContext {
  // Helper functions needed by the current contract (replaces individual boolean flags)
  helpers: Set<string>;

  // Array helper keys needed by the current contract
  currentNeededArrayHelpers: string[];

  // Type name registries across all contracts in the current file
  allKnownEnumNames: Set<string>;
  allKnownInterfaceNames: Set<string>;

  // Current function return type (set during function generation for enum→uint256 casts)
  currentFunctionReturnType: import("../types/index.ts").SkittlesType | null;

  // State variable names whose type is an enum (set per-contract)
  currentEnumStateVarNames: Set<string>;
}

export function createCodegenContext(): CodegenContext {
  return {
    helpers: new Set(),
    currentNeededArrayHelpers: [],
    allKnownEnumNames: new Set(),
    allKnownInterfaceNames: new Set(),
    currentFunctionReturnType: null,
    currentEnumStateVarNames: new Set(),
  };
}

export let cctx: CodegenContext = createCodegenContext();

export function resetCodegenContext(): void {
  cctx = createCodegenContext();
}
