import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import type { SkittlesConfig } from "../types/index.ts";
import { DEFAULT_CONFIG } from "./defaults.ts";

const CONFIG_FILENAMES = ["skittles.config.json", "skittles.config.js"];

/**
 * Validate that a loaded config has the expected shape and types.
 */
function validateConfig(config: unknown): Partial<SkittlesConfig> {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error("Config must be an object");
  }

  const obj = config as Record<string, unknown>;

  if ("typeCheck" in obj && typeof obj.typeCheck !== "boolean") {
    throw new Error('Config "typeCheck" must be a boolean');
  }

  if ("optimizer" in obj) {
    if (typeof obj.optimizer !== "object" || obj.optimizer === null) {
      throw new Error('Config "optimizer" must be an object');
    }
    const opt = obj.optimizer as Record<string, unknown>;
    if ("enabled" in opt && typeof opt.enabled !== "boolean") {
      throw new Error('Config "optimizer.enabled" must be a boolean');
    }
    if ("runs" in opt && typeof opt.runs !== "number") {
      throw new Error('Config "optimizer.runs" must be a number');
    }
  }

  if ("contractsDir" in obj && typeof obj.contractsDir !== "string") {
    throw new Error('Config "contractsDir" must be a string');
  }

  if ("outputDir" in obj && typeof obj.outputDir !== "string") {
    throw new Error('Config "outputDir" must be a string');
  }

  if ("cacheDir" in obj && typeof obj.cacheDir !== "string") {
    throw new Error('Config "cacheDir" must be a string');
  }

  if ("consoleLog" in obj && typeof obj.consoleLog !== "boolean") {
    throw new Error('Config "consoleLog" must be a boolean');
  }

  if ("solidity" in obj) {
    if (typeof obj.solidity !== "object" || obj.solidity === null) {
      throw new Error('Config "solidity" must be an object');
    }
    const sol = obj.solidity as Record<string, unknown>;
    if ("version" in sol && typeof sol.version !== "string") {
      throw new Error('Config "solidity.version" must be a string');
    }
    if ("license" in sol && typeof sol.license !== "string") {
      throw new Error('Config "solidity.license" must be a string');
    }
  }

  if ("formatting" in obj) {
    if (typeof obj.formatting !== "object" || obj.formatting === null) {
      throw new Error('Config "formatting" must be an object');
    }
    const fmt = obj.formatting as Record<string, unknown>;
    if ("indent" in fmt) {
      if (fmt.indent !== "tab" && typeof fmt.indent !== "number") {
        throw new Error(
          'Config "formatting.indent" must be a number or "tab"'
        );
      }
    }
    if ("bracketSpacing" in fmt && typeof fmt.bracketSpacing !== "boolean") {
      throw new Error('Config "formatting.bracketSpacing" must be a boolean');
    }
    if ("braceStyle" in fmt) {
      if (fmt.braceStyle !== "same-line" && fmt.braceStyle !== "next-line") {
        throw new Error(
          'Config "formatting.braceStyle" must be "same-line" or "next-line"'
        );
      }
    }
    if ("formatOutput" in fmt && typeof fmt.formatOutput !== "boolean") {
      throw new Error('Config "formatting.formatOutput" must be a boolean');
    }
  }

  return config as Partial<SkittlesConfig>;
}

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
      let rawConfig: unknown;

      if (filename.endsWith(".json")) {
        const raw = fs.readFileSync(configPath, "utf-8");
        try {
          rawConfig = JSON.parse(raw);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          throw new Error(
            `Failed to parse skittles.config.json: ${message}`
          );
        }
      } else {
        const configUrl = pathToFileURL(configPath).href;
        const configModule = await import(configUrl);
        rawConfig = configModule.default || configModule;
      }

      const userConfig = validateConfig(rawConfig);
      return mergeConfig(userConfig);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.startsWith("Failed to parse skittles.config.json")
      ) {
        throw err;
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new Error(`Failed to load config from ${filename}: ${message}`);
    }
  }

  return DEFAULT_CONFIG;
}

function mergeConfig(
  userConfig: Partial<SkittlesConfig>
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
    cacheDir: userConfig.cacheDir ?? DEFAULT_CONFIG.cacheDir,
    consoleLog: userConfig.consoleLog ?? DEFAULT_CONFIG.consoleLog,
    solidity: {
      version: userConfig.solidity?.version ?? DEFAULT_CONFIG.solidity.version,
      license: userConfig.solidity?.license ?? DEFAULT_CONFIG.solidity.license,
    },
    formatting: {
      indent:
        userConfig.formatting?.indent ?? DEFAULT_CONFIG.formatting.indent,
      bracketSpacing:
        userConfig.formatting?.bracketSpacing ??
        DEFAULT_CONFIG.formatting.bracketSpacing,
      braceStyle:
        userConfig.formatting?.braceStyle ??
        DEFAULT_CONFIG.formatting.braceStyle,
      formatOutput:
        userConfig.formatting?.formatOutput ??
        DEFAULT_CONFIG.formatting.formatOutput,
    },
  };
}

export { DEFAULT_CONFIG } from "./defaults.ts";
