import ora from "ora";
import { loadConfig } from "../config/config.ts";
import { compile } from "../compiler/compiler.ts";
import { logSuccess, logError } from "../utils/console.ts";

export async function compileCommand(projectRoot: string): Promise<void> {
  const spinner = ora("Loading configuration...").start();

  try {
    const config = await loadConfig(projectRoot);
    spinner.text = "Compiling contracts...";

    const result = await compile(projectRoot, config);

    if (result.success) {
      spinner.succeed("Compilation complete");
      logSuccess(
        `${result.artifacts.length} contract(s) compiled successfully`
      );
    } else {
      spinner.fail("Compilation failed");
      for (const error of result.errors) {
        logError(error);
      }
      process.exit(1);
    }
  } catch (err) {
    spinner.fail("Compilation failed");
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";
    logError(message);
    process.exit(1);
  }
}
