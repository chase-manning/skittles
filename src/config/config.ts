import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

import type { SkittlesConfig } from "../types/index.ts";
import { getErrorMessage } from "../utils/error.ts";
import { DEFAULT_CONFIG } from "./defaults.ts";

const CONFIG_FILENAMES = ["skittles.config.json", "skittles.config.js"];

function validateKey(
  obj: Record<string, unknown>,
  key: string,
  expectedType: string,
  configPath?: string
): void {
  if (key in obj && typeof obj[key] !== expectedType) {
    const label = configPath ? `${configPath}.${key}` : key;
    throw new Error(`Config "${label}" must be a ${expectedType}`);
  }
}

function validateNested(
  obj: Record<string, unknown>,
  key: string,
  validator: (nested: Record<string, unknown>) => void
): void {
  if (!(key in obj)) return;
  if (typeof obj[key] !== "object" || obj[key] === null) {
    throw new Error(`Config "${key}" must be an object`);
  }
  validator(obj[key] as Record<string, unknown>);
}

/**
 * Validate that a loaded config has the expected shape and types.
 */
function validateConfig(config: unknown): Partial<SkittlesConfig> {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error("Config must be an object");
  }

  const obj = config as Record<string, unknown>;

  validateKey(obj, "typeCheck", "boolean");
  validateKey(obj, "contractsDir", "string");
  validateKey(obj, "outputDir", "string");
  validateKey(obj, "cacheDir", "string");
  validateKey(obj, "consoleLog", "boolean");

  validateNested(obj, "optimizer", (opt) => {
    validateKey(opt, "enabled", "boolean", "optimizer");
    validateKey(opt, "runs", "number", "optimizer");
  });

  validateNested(obj, "solidity", (sol) => {
    validateKey(sol, "version", "string", "solidity");
    validateKey(sol, "license", "string", "solidity");
  });

  validateNested(obj, "formatting", (fmt) => {
    if ("indent" in fmt) {
      if (fmt.indent !== "tab" && typeof fmt.indent !== "number") {
        throw new Error(
          'Config "formatting.indent" must be a number or "tab"'
        );
      }
    }
    validateKey(fmt, "bracketSpacing", "boolean", "formatting");
    if ("braceStyle" in fmt) {
      if (fmt.braceStyle !== "same-line" && fmt.braceStyle !== "next-line") {
        throw new Error(
          'Config "formatting.braceStyle" must be "same-line" or "next-line"'
        );
      }
    }
    validateKey(fmt, "formatOutput", "boolean", "formatting");
  });

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
          const message = getErrorMessage(err);
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
      const message = getErrorMessage(err);
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
