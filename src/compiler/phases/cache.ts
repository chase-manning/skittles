import crypto from "crypto";
import fs from "fs";
import path from "path";

import { getPackageVersion } from "../../utils/package.ts";
import { cachePath } from "../../utils/paths.ts";
import { CACHE_HASH_LENGTH, CACHE_VERSION } from "../constants.ts";

const PACKAGE_VERSION: string = getPackageVersion();

export interface CacheEntry {
  fileHash: string;
  sharedHash: string;
  depsHash: string;
  configHash: string;
  contracts: {
    name: string;
    solidity: string;
  }[];
  resolvedMutabilities?: Record<string, Record<string, string>>;
  contractFunctions?: Record<string, Record<string, string>>;
  contractInherits?: Record<string, string[]>;
}

export interface CompilationCache {
  version: string;
  skittlesVersion: string;
  files: Record<string, CacheEntry>;
}

export function hashString(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, CACHE_HASH_LENGTH);
}

export function baseName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

export function loadCache(outputDir: string): CompilationCache {
  const cacheFile = cachePath(outputDir);
  try {
    if (fs.existsSync(cacheFile)) {
      const data = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      if (
        data.version === CACHE_VERSION &&
        data.skittlesVersion === PACKAGE_VERSION
      )
        return data;
    }
  } catch (_err) {
    // Intentionally ignored – corrupt cache, start fresh
  }
  return {
    version: CACHE_VERSION,
    skittlesVersion: PACKAGE_VERSION,
    files: {},
  };
}

export function saveCache(outputDir: string, cache: CompilationCache): void {
  const cacheFile = cachePath(outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(cache), "utf-8");
}

/**
 * Write the updated incremental build cache to disk.
 */
export function updateCache(cacheDir: string, newCache: CompilationCache): void {
  try {
    saveCache(cacheDir, newCache);
  } catch (_err) {
    // Intentionally ignored – non-critical if cache save fails
  }
}

export function createNewCache(): CompilationCache {
  return {
    version: CACHE_VERSION,
    skittlesVersion: PACKAGE_VERSION,
    files: {},
  };
}
