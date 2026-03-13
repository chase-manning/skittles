import path from "path";

import type { SkittlesConfig } from "../types/index.ts";

/**
 * Resolve the absolute path to the contracts source directory.
 */
export function contractsDir(
  projectRoot: string,
  config: Pick<Required<SkittlesConfig>, "contractsDir">
): string {
  return path.join(projectRoot, config.contractsDir);
}

/**
 * Resolve the absolute path to the build output directory.
 */
export function outputDir(
  projectRoot: string,
  config: Pick<Required<SkittlesConfig>, "outputDir">
): string {
  return path.join(projectRoot, config.outputDir);
}

/**
 * Resolve the absolute path to the incremental build cache directory.
 */
export function cacheDir(
  projectRoot: string,
  config: Pick<Required<SkittlesConfig>, "cacheDir">
): string {
  return path.join(projectRoot, config.cacheDir);
}

/**
 * Resolve the absolute path to a generated Solidity output file.
 */
export function solidityOutputPath(outputDir: string, baseName: string): string {
  return path.join(outputDir, "solidity", baseName);
}

/**
 * Resolve the absolute path to the compilation cache JSON file.
 */
export function cachePath(outputDir: string): string {
  return path.join(outputDir, ".skittles-cache.json");
}
