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
  formatting?: FormattingConfig;
}

export interface SolidityConfig {
  version?: string;
  license?: string;
}

export interface FormattingConfig {
  indent?: number | "tab";
  bracketSpacing?: boolean;
  braceStyle?: "same-line" | "next-line";
  formatOutput?: boolean;
}

export interface OptimizerConfig {
  enabled?: boolean;
  runs?: number;
}
