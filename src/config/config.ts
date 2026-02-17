import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import type { SkittlesConfig } from "../types/index.ts";

const CONFIG_FILENAMES = ["skittles.config.json", "skittles.config.js"];

const DEFAULT_CONFIG: Required<SkittlesConfig> = {
  typeCheck: true,
  optimizer: {
    enabled: false,
    runs: 200,
  },
  contractsDir: "contracts",
  outputDir: "build",
};

/**
 * Load the skittles config from the project root.
 * Looks for skittles.config.json or skittles.config.js.
 * Falls back to defaults if no config file is found.
 */
export async function loadConfig(
  projectRoot: string
): Promise<Required<SkittlesConfig>> {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = path.join(projectRoot, filename);

    if (!fs.existsSync(configPath)) {
      continue;
    }

    try {
      let userConfig: SkittlesConfig;

      if (filename.endsWith(".json")) {
        const raw = fs.readFileSync(configPath, "utf-8");
        userConfig = JSON.parse(raw);
      } else {
        const configUrl = pathToFileURL(configPath).href;
        const configModule = await import(configUrl);
        userConfig = configModule.default || configModule;
      }

      return mergeConfig(userConfig);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      throw new Error(`Failed to load config from ${filename}: ${message}`);
    }
  }

  return DEFAULT_CONFIG;
}

function mergeConfig(
  userConfig: SkittlesConfig
): Required<SkittlesConfig> {
  return {
    typeCheck: userConfig.typeCheck ?? DEFAULT_CONFIG.typeCheck,
    optimizer: {
      enabled:
        userConfig.optimizer?.enabled ?? DEFAULT_CONFIG.optimizer.enabled,
      runs: userConfig.optimizer?.runs ?? DEFAULT_CONFIG.optimizer.runs,
    },
    contractsDir: userConfig.contractsDir ?? DEFAULT_CONFIG.contractsDir,
    outputDir: userConfig.outputDir ?? DEFAULT_CONFIG.outputDir,
  };
}

export { DEFAULT_CONFIG };
