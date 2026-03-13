import { beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import type { SkittlesConfig } from "../src/types";

export const defaultConfig: Required<SkittlesConfig> = {
  typeCheck: true,
  optimizer: { enabled: false, runs: 200 },
  contractsDir: "contracts",
  outputDir: "artifacts",
  cacheDir: "cache",
  consoleLog: false,
};

/**
 * Register beforeEach/afterEach hooks that create and clean up a temporary
 * directory scoped to the calling test file.
 *
 * @param baseDir  The directory that will contain the temp folder (typically `__dirname`).
 * @param name     A unique name for the temp folder (default `"__test_tmp__"`).
 * @returns The absolute path to the temporary directory.
 */
export function useTempDir(baseDir: string, name = "__test_tmp__"): string {
  const dir = path.join(baseDir, name);

  beforeEach(() => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  return dir;
}
