import { loadConfig } from "../config/config.ts";
import { logError, logInfo, logSuccess } from "../utils/console.ts";
import { getErrorMessage } from "../utils/error.ts";
import { removeDirectory } from "../utils/file.ts";
import {
  cacheDir as resolveCacheDir,
  outputDir as resolveOutputDir,
} from "../utils/paths.ts";

export async function cleanCommand(projectRoot: string): Promise<void> {
  try {
    const config = await loadConfig(projectRoot);
    const outputDir = resolveOutputDir(projectRoot, config);
    const cacheDir = resolveCacheDir(projectRoot, config);
    logInfo(`Removing output directory: ${config.outputDir}/`);
    removeDirectory(outputDir);
    logInfo(`Removing cache directory: ${config.cacheDir}/`);
    removeDirectory(cacheDir);
    logSuccess("Build artifacts cleaned");
  } catch (err) {
    const message = getErrorMessage(err);
    logError(message);
    process.exit(1);
  }
}
