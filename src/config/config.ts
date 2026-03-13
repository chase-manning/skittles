import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import type { SkittlesConfig } from "../types/index.ts";
import { DEFAULT_CONFIG } from "./defaults.ts";
import { getErrorMessage } from "../utils/error.ts";

const CONFIG_FILENAMES = ["skittles.config.json", "skittles.config.js"];

function requireString(
  obj: Record<string, unknown>,
  key: string,
  prefix?: string
): void {
  if (key in obj && typeof obj[key] !== "string") {
    const label = prefix ? `${prefix}.${key}` : key;
    throw new Error(`Config "${label}" must be a string`);
  }
}

function requireBoolean(
  obj: Record<string, unknown>,
  key: string,
  prefix?: string
): void {
  if (key in obj && typeof obj[key] !== "boolean") {
    const label = prefix ? `${prefix}.${key}` : key;
    throw new Error(`Config "${label}" must be a boolean`);
  }
}

function requireNumber(
  obj: Record<string, unknown>,
  key: string,
  prefix?: string
): void {
  if (key in obj && typeof obj[key] !== "number") {
    const label = prefix ? `${prefix}.${key}` : key;
    throw new Error(`Config "${label}" must be a number`);
  }
}

function requireObject(
  obj: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined {
  if (!(key in obj)) return undefined;
  if (typeof obj[key] !== "object" || obj[key] === null) {
    throw new Error(`Config "${key}" must be an object`);
  }
  return obj[key] as Record<string, unknown>;
}

/**
 * Validate that a loaded config has the expected shape and types.
 */
function validateConfig(config: unknown): Partial<SkittlesConfig> {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error("Config must be an object");
  }

  const obj = config as Record<string, unknown>;

  requireBoolean(obj, "typeCheck");
  requireString(obj, "contractsDir");
  requireString(obj, "outputDir");
  requireString(obj, "cacheDir");
  requireBoolean(obj, "consoleLog");

  const opt = requireObject(obj, "optimizer");
  if (opt) {
    requireBoolean(opt, "enabled", "optimizer");
    requireNumber(opt, "runs", "optimizer");
  }

  const sol = requireObject(obj, "solidity");
  if (sol) {
    requireString(sol, "version", "solidity");
    requireString(sol, "license", "solidity");
  }

  const fmt = requireObject(obj, "formatting");
  if (fmt) {
    if ("indent" in fmt) {
      if (fmt.indent !== "tab" && typeof fmt.indent !== "number") {
        throw new Error(
          'Config "formatting.indent" must be a number or "tab"'
        );
      }
    }
    requireBoolean(fmt, "bracketSpacing", "formatting");
    if ("braceStyle" in fmt) {
      if (fmt.braceStyle !== "same-line" && fmt.braceStyle !== "next-line") {
        throw new Error(
          'Config "formatting.braceStyle" must be "same-line" or "next-line"'
        );
      }
    }
    requireBoolean(fmt, "formatOutput", "formatting");
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
