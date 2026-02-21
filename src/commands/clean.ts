import path from "path";
import { removeDirectory } from "../utils/file.ts";
import { logSuccess, logInfo } from "../utils/console.ts";
import { loadConfig } from "../config/config.ts";

export async function cleanCommand(projectRoot: string): Promise<void> {
  const config = await loadConfig(projectRoot);
  const outputDir = path.join(projectRoot, config.outputDir);
  const cacheDir = path.join(projectRoot, config.cacheDir);
  logInfo(`Removing output directory: ${config.outputDir}/`);
  removeDirectory(outputDir);
  logInfo(`Removing cache directory: ${config.cacheDir}/`);
  removeDirectory(cacheDir);
  logSuccess("Build artifacts cleaned");
}
