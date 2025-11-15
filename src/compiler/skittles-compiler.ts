import ora from "ora";
import "ts-node/register";
import getAbi from "../abi/get-abi";
import getBytecode from "../bytecode/get-bytecode";
import { readFile, updateCache, writeBuildFile } from "../helpers/file-helper";
import { SkittlesConfig } from "../types/core-types";
import SkittlesContract from "../types/skittles-contract";
import SkittlesCache from "../types/skittles-cache";
import getYul from "../yul/get-yul";
import getFileData, { FileData } from "./get-file-data";
import path from "path";

const doTask = (task: string, fn: () => any) => {
  const spinner = ora(task).start();
  const response = fn();
  spinner.succeed();
  return response;
};

const getConfig = (): SkittlesConfig => {
  try {
    return require(`${process.cwd()}/skittles.config.ts`);
  } catch {
    throw new Error("No skittles.config.ts file found");
  }
};

const getCache = (): SkittlesCache => {
  const cachePath = path.join(process.cwd(), "build/cache.json");
  const cacheContent = readFile(cachePath);

  // If file doesn't exist or is empty, return empty cache
  if (!cacheContent || cacheContent.trim() === "" || cacheContent === "{}") {
    return {
      version: "",
      files: {},
    };
  }

  // Try to parse the cache file
  try {
    const parsed = JSON.parse(cacheContent);
    // Validate basic structure
    if (typeof parsed === "object" && parsed !== null) {
      return {
        version: parsed.version || "",
        files: parsed.files || {},
      };
    }
    // If structure is invalid, return empty cache
    return {
      version: "",
      files: {},
    };
  } catch (error) {
    // If JSON is malformed, return empty cache
    // This allows compilation to continue with a fresh cache
    return {
      version: "",
      files: {},
    };
  }
};

/**
 * Checks if a contract needs to be recompiled by comparing file hashes and dependencies.
 */
const needsRecompilation = (contractName: string, fileData: FileData[]): boolean => {
  // Check if any file containing this contract or its dependencies has changed
  const contractFile = fileData.find((fd) => fd.contracts.some((c) => c.name === contractName));
  if (!contractFile) return true;
  if (contractFile.changed) return true;

  // Check if any dependency has changed
  return contractFile.dependencies.some((dep) => {
    const depFile = fileData.find((f) => f.path === dep);
    return depFile?.changed || false;
  });
};

/**
 * Collects all contracts that need compilation.
 */
const collectContractsToCompile = (
  fileData: FileData[]
): Array<{ contract: SkittlesContract; fileData: FileData }> => {
  const contractsToCompile: Array<{ contract: SkittlesContract; fileData: FileData }> = [];

  fileData.forEach((fd) => {
    fd.contracts.forEach((contract) => {
      if (needsRecompilation(contract.name, fileData)) {
        contractsToCompile.push({ contract, fileData: fd });
      }
    });
  });

  return contractsToCompile;
};

const skittlesCompile = () => {
  try {
    // Loading cache and config
    const cache = getCache();
    const config = getConfig();

    // Getting file data
    const fileData: FileData[] = doTask("Processing Files", () => {
      return getFileData(cache);
    });

    // Updating cache
    try {
      updateCache(fileData);
    } catch (error: any) {
      throw new Error(`Failed to update cache: ${error?.message || "Unknown error"}`);
    }

    // Collect contracts that need compilation (incremental compilation)
    const contractsToCompile = collectContractsToCompile(fileData);

    if (contractsToCompile.length === 0) {
      console.log("✓ All contracts are up to date");
      return;
    }

    // Compile contracts sequentially (Yul mode only supports one file at a time)
    // But we still benefit from incremental compilation - only compiling what changed
    contractsToCompile.forEach(({ contract }, index) => {
      const { name } = contract;
      const progress =
        contractsToCompile.length > 1 ? `[${index + 1}/${contractsToCompile.length}] ` : "";
      doTask(`${progress}Compiling ${name}`, () => {
        try {
          const abi = getAbi(contract);
          writeBuildFile(`${name}.abi`, JSON.stringify(abi, null, 2), "abi");
          const yul = getYul(contract, abi);
          writeBuildFile(`${name}.yul`, yul, "yul");
          const bytecode = getBytecode(name, yul, config);
          writeBuildFile(`${name}.bytecode`, bytecode, "bytecode");
        } catch (error: any) {
          throw new Error(
            `Failed to compile contract "${name}": ${error?.message || "Unknown error"}`
          );
        }
      });
    });
  } catch (error: any) {
    throw new Error(`Compilation failed: ${error?.message || "Unknown error"}`);
  }
};

export default skittlesCompile;
