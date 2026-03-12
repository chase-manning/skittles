// ============================================================
// Config
// ============================================================

export interface SkittlesConfig {
  typeCheck?: boolean;
  optimizer?: OptimizerConfig;
  contractsDir?: string;
  outputDir?: string;
  cacheDir?: string;
  consoleLog?: boolean;
  solidity?: SolidityConfig;
}

export interface SolidityConfig {
  version?: string;
  license?: string;
}

export interface OptimizerConfig {
  enabled?: boolean;
  runs?: number;
}
