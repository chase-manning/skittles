export interface CodegenContext {
  // Helper functions needed by the current contract (replaces individual boolean flags)
  helpers: Set<string>;

  // Array helper keys needed by the current contract
  currentNeededArrayHelpers: string[];

  // Type name registries across all contracts in the current file
  allKnownEnumNames: Set<string>;
  allKnownInterfaceNames: Set<string>;
}

export function createCodegenContext(): CodegenContext {
  return {
    helpers: new Set(),
    currentNeededArrayHelpers: [],
    allKnownEnumNames: new Set(),
    allKnownInterfaceNames: new Set(),
  };
}

export let cctx: CodegenContext = createCodegenContext();

export function resetCodegenContext(): void {
  cctx = createCodegenContext();
}
