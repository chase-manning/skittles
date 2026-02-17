import type { SkittlesConfig } from "../src/types";

export const defaultConfig: Required<SkittlesConfig> = {
  typeCheck: true,
  optimizer: { enabled: false, runs: 200 },
  contractsDir: "contracts",
  outputDir: "build",
};
