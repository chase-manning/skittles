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

const skittlesCompile = () => {
  // Loading cache and config
  const cache = getCache();
  const config = getConfig();

  // Getting file data
  const fileData: FileData[] = doTask("Processing Files", () => getFileData(cache));

  // Updating cache
  updateCache(fileData);

  // Compiling Contracts
  fileData.forEach((fd) => {
    fd.contracts.forEach((contract: SkittlesContract) => {
      const { name } = contract;
      doTask(`Compiling ${name}`, () => {
        const abi = getAbi(contract);
        writeBuildFile(`${name}.abi`, JSON.stringify(abi, null, 2), "abi");
        const yul = getYul(contract, abi);
        writeBuildFile(`${name}.yul`, yul, "yul");
        const bytecode = getBytecode(name, yul, config);
        writeBuildFile(`${name}.bytecode`, bytecode, "bytecode");
      });
    });
  });
};

export default skittlesCompile;
