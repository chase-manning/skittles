import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { loadConfig } from "../config/config.ts";
import { compile } from "../compiler/compiler.ts";
import { logSuccess, logError, logInfo } from "../utils/console.ts";

/**
 * Resolve the path to a locally installed binary in node_modules/.bin.
 * Returns the binary name as a fallback if not found locally.
 */
function resolveLocalBin(projectRoot: string, bin: string): string {
  const localPath = path.join(projectRoot, "node_modules", ".bin", bin);
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  return bin;
}

/**
 * The `skittles test` command.
 * 1. Compiles all contracts (same as `skittles compile`)
 * 2. Runs vitest
 */
export async function testCommand(
  projectRoot: string,
  watch: boolean
): Promise<void> {
  // Step 1: Compile contracts
  logInfo("Compiling contracts before running tests...");

  try {
    const config = await loadConfig(projectRoot);
    const result = await compile(projectRoot, config);

    if (!result.success) {
      for (const error of result.errors) {
        logError(error);
      }
      process.exit(1);
    }

    logSuccess(
      `${result.artifacts.length} contract(s) compiled successfully`
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";
    logError(`Compilation failed: ${message}`);
    process.exit(1);
  }

  // Step 2: Run vitest using the locally installed binary
  logInfo(watch ? "Starting vitest in watch mode..." : "Running tests...");

  const vitestBin = resolveLocalBin(projectRoot, "vitest");
  const args = watch ? ["--watch"] : ["run"];
  const child = spawn(vitestBin, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true,
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });

  child.on("error", (err) => {
    logError(`Failed to start vitest: ${err.message}`);
    logInfo(
      "Make sure vitest is installed: npm install --save-dev vitest"
    );
    process.exit(1);
  });
}
