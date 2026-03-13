import fs from "fs";
import path from "path";
import ora from "ora";
import { loadConfig } from "../config/config.ts";
import { compile } from "../compiler/compiler.ts";
import { logSuccess, logError, logInfo } from "../utils/console.ts";

const DEBOUNCE_MS = 200;

async function executeCompilation(
  projectRoot: string,
  options?: { exitOnError?: boolean }
): Promise<boolean> {
  const spinner = ora({
    text: "Loading configuration...",
    color: "cyan",
  }).start();

  try {
    const config = await loadConfig(projectRoot);
    spinner.text = "Compiling contracts...";

    const result = await compile(projectRoot, config);

    if (result.success) {
      spinner.succeed("Compilation complete");
      logSuccess(
        `${result.artifacts.length} contract(s) compiled successfully`
      );
      return true;
    } else {
      spinner.fail("Compilation failed");
      for (const error of result.errors) {
        logError(error);
      }
      if (options?.exitOnError) {
        process.exit(1);
      }
      return false;
    }
  } catch (err) {
    spinner.fail("Compilation failed");
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";
    logError(message);
    if (options?.exitOnError) {
      process.exit(1);
    }
    return false;
  }
}

export async function compileCommand(projectRoot: string): Promise<void> {
  await executeCompilation(projectRoot, { exitOnError: true });
}

export async function watchCompile(projectRoot: string): Promise<() => void> {
  const config = await loadConfig(projectRoot);
  const contractsDir = path.join(projectRoot, config.contractsDir);

  // Run initial compilation
  await executeCompilation(projectRoot);

  logInfo(`Watching for file changes in ${config.contractsDir}/...`);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  const watcher = fs.watch(
    contractsDir,
    { recursive: true },
    (_event, filename) => {
      if (!filename || !filename.endsWith(".ts")) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        logInfo(`File changed: ${filename}`);
        void executeCompilation(projectRoot);
      }, DEBOUNCE_MS);
    }
  );

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    watcher.close();
  };
}
