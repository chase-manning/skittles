import fs from "fs";
import path from "path";
import { afterEach, beforeEach } from "vitest";

import { DEFAULT_CONFIG } from "../src/config/defaults";

export const defaultConfig = { ...DEFAULT_CONFIG, consoleLog: false };

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
