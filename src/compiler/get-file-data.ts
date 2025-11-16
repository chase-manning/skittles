import { SourceFile } from "typescript";
import { getAstFromFile } from "../ast/get-ast";
import { CACHE_VERSION } from "../data/constants";
import { getDependencies } from "../helpers/ast-helper";
import { getAllTypescriptFiles, readFile } from "../helpers/file-helper";
import { hashString } from "../helpers/string-helper";
import getSkittlesConstants from "../skittles-contract/get-skittles-constants";
import getSkittlesContracts from "../skittles-contract/get-skittles-contracts";
import getSkittlesFunctions from "../skittles-contract/get-skittles-functions";
import getSkittlesInterfaces from "../skittles-contract/get-skittles-interfaces";
import SkittlesCache, { FileCache } from "../types/skittles-cache";
import SkittlesContract, {
  SkittlesConstants,
  SkittlesInterfaces,
  SkittlesMethod,
} from "../types/skittles-contract";
import { mergeConstants, mergeFunctions, mergeInterfaces } from "./dependency-merger";

export interface FileData {
  path: string;
  hash: number;
  fileContent: string;
  changed: boolean;
  dependencies: string[];
  ast: SourceFile;
  constants: SkittlesConstants;
  interfaces: SkittlesInterfaces;
  functions: SkittlesMethod[];
  contracts: SkittlesContract[];
}

const getFileCache = (cache: SkittlesCache, filePath: string): FileCache | null => {
  if (!cache) return null;
  if (!cache.version) return null;
  if (cache.version !== CACHE_VERSION) return null;
  if (!cache.files) return null;
  if (!cache.files[filePath]) return null;
  return cache.files[filePath];
};

const getData = (cache: SkittlesCache, filePaths: string[], filesAdded: string[]): FileData[] => {
  if (filePaths.length === 0) return [];
  const fileData: FileData[] = [];
  filePaths.forEach((path) => {
    if (filesAdded.includes(path)) return;
    const fileContent = readFile(path);
    const hash = hashString(fileContent);
    const fc = getFileCache(cache, path);
    const changed = fc?.hash !== hash;
    const ast = changed ? getAstFromFile(fileContent) : fc.ast;
    const dependencies = changed ? getDependencies(ast, path) : fc.dependencies;
    filesAdded.push(path);
    fileData.push({
      path,
      hash,
      fileContent,
      changed,
      dependencies,
      ast,
      constants: {},
      interfaces: {},
      contracts: [],
      functions: [],
    });
  });

  fileData.push(
    ...getData(
      cache,
      fileData.flatMap((fd) => fd.dependencies),
      filesAdded
    )
  );
  return fileData;
};

const getBaseFileData = (cache: SkittlesCache): FileData[] => {
  const fileData: FileData[] = [];
  const contractFiles = getAllTypescriptFiles();
  fileData.push(...getData(cache, contractFiles, []));
  return fileData;
};

/**
 * Gets data from cache if available and unchanged, otherwise computes it.
 */
const getCachedOrComputed = <T>(
  cache: SkittlesCache,
  data: FileData,
  cacheGetter: (fc: FileCache) => T,
  computeFn: () => T
): T => {
  const fc = getFileCache(cache, data.path);
  return data.changed || !fc ? computeFn() : cacheGetter(fc);
};

const getFileData = (cache: SkittlesCache): FileData[] => {
  const baseFileData: FileData[] = getBaseFileData(cache);

  // Updates data if a dependency has changed
  const updatedFileData: FileData[] = baseFileData.map((data) => {
    if (data.changed) return data;
    const changed = data.dependencies.some((dependency) => {
      const depData = baseFileData.find((f) => f.path === dependency);
      if (!depData) throw new Error(`Dependency ${dependency} not found`);
      return depData.changed;
    });
    const ast = changed ? getAstFromFile(data.fileContent) : data.ast;
    const dependencies = changed ? getDependencies(ast, data.path) : data.dependencies;
    return {
      ...data,
      ast,
      dependencies,
      changed,
    };
  });

  // Gets interfaces
  const fdWithInterfaces = updatedFileData.map((data) => {
    const interfaces = getCachedOrComputed(
      cache,
      data,
      (fc) => fc.interfaces,
      () => getSkittlesInterfaces(data.ast)
    );
    return {
      ...data,
      interfaces,
    };
  });
  const fdWithInterfaceDependencies = mergeInterfaces(fdWithInterfaces);

  // Gets constants
  const fdWithConstants = fdWithInterfaceDependencies.map((data) => {
    const constants = getCachedOrComputed(
      cache,
      data,
      (fc) => fc.constants,
      () => getSkittlesConstants(data.ast, data.interfaces)
    );
    return {
      ...data,
      constants,
    };
  });
  const fdWithConstantDependencies = mergeConstants(fdWithConstants);

  // Gets functions
  const fdWithFunctions = fdWithConstantDependencies.map((data) => {
    const functions = getCachedOrComputed(
      cache,
      data,
      (fc) => fc.functions,
      () => getSkittlesFunctions(data.ast, data.interfaces, data.constants, [])
    );
    return {
      ...data,
      functions,
    };
  });
  const fdWithFunctionDependencies = mergeFunctions(fdWithFunctions);

  // Gets contracts
  const fdWithContracts = fdWithFunctionDependencies.map((data) => {
    const contracts = getCachedOrComputed(
      cache,
      data,
      (fc) => fc.contracts,
      () => getSkittlesContracts(data.ast, data.interfaces, data.constants, data.functions)
    );
    return {
      ...data,
      contracts,
    };
  });

  // Add extensions to contracts
  const fdWithContractExtensions = fdWithContracts.map((data) => {
    if (!data.changed) return data;
    const contracts = data.contracts.map((contract) => {
      const { events, variables, methods } = contract;
      contract.extensions.forEach((extension) => {
        const exContract = fdWithContracts
          .map((f) => f.contracts)
          .flat()
          .find((c) => c.name === extension);
        if (exContract) {
          events.push(...exContract.events);
          variables.push(...exContract.variables);
          methods.push(...exContract.methods);
        }
      });

      return {
        ...contract,
        events,
        variables,
        methods,
      };
    });
    return {
      ...data,
      contracts,
    };
  });

  return fdWithContractExtensions;
};

export default getFileData;
