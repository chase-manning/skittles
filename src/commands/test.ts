import { spawn } from "child_process";
import { loadConfig } from "../config/config.ts";
import { compile } from "../compiler/compiler.ts";
import { logSuccess, logError, logInfo } from "../utils/console.ts";

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

  // Step 2: Run vitest
  logInfo(watch ? "Starting vitest in watch mode..." : "Running tests...");

  const args = watch ? ["--watch"] : ["run"];
  const child = spawn("npx", ["vitest", ...args], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true,
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });

  child.on("error", (err) => {
    logError(`Failed to start vitest: ${err.message}`);
    logInfo('Make sure vitest is installed: npm install --save-dev vitest');
    process.exit(1);
  });
}
