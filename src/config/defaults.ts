import type { SkittlesConfig } from "../types/index.ts";

export const DEFAULT_CONFIG: Required<SkittlesConfig> = {
  typeCheck: true,
  optimizer: {
    enabled: false,
    runs: 200,
  },
  contractsDir: "contracts",
  outputDir: "artifacts",
  cacheDir: "cache",
  consoleLog: false,
  solidity: {
    version: "^0.8.20",
    license: "MIT",
  },
};
