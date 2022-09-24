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
    const fc = getFileCache(cache, data.path);
    const interfaces = data.changed || !fc ? getSkittlesInterfaces(data.ast) : fc.interfaces;
    return {
      ...data,
      interfaces,
    };
  });
  const fdWithInterfaceDependencies = fdWithInterfaces.map((data) => {
    if (!data.changed) return data;
    const interfaces = data.interfaces;
    data.dependencies.forEach((dep) => {
      const depData = fdWithInterfaces.find((f) => f.path === dep);
      if (!depData) throw new Error(`Dependency ${dep} not found`);
      Object.keys(depData.interfaces).forEach((key) => {
        interfaces[key] = depData.interfaces[key];
      });
    });
    return {
      ...data,
      interfaces,
    };
  });

  // Gets constants
  const fdWithConstants = fdWithInterfaceDependencies.map((data) => {
    const fc = getFileCache(cache, data.path);
    const constants =
      data.changed || !fc ? getSkittlesConstants(data.ast, data.interfaces) : fc.constants;
    return {
      ...data,
      constants,
    };
  });
  const fdWithConstantDependencies = fdWithConstants.map((data) => {
    if (!data.changed) return data;
    const constants = data.constants;
    data.dependencies.forEach((dep) => {
      const depData = fdWithConstants.find((f) => f.path === dep);
      if (!depData) throw new Error(`Dependency ${dep} not found`);
      Object.keys(depData.constants).forEach((key) => {
        constants[key] = depData.constants[key];
      });
    });
    return {
      ...data,
      constants,
    };
  });

  // Gets functions
  const fdWithFunctions = fdWithConstantDependencies.map((data) => {
    const fc = getFileCache(cache, data.path);
    const functions =
      data.changed || !fc
        ? getSkittlesFunctions(data.ast, data.interfaces, data.constants, [])
        : fc.functions;
    return {
      ...data,
      functions,
    };
  });
  const fdWithFunctionDependencies = fdWithFunctions.map((data) => {
    if (!data.changed) return data;
    const functions = data.functions;
    data.dependencies.forEach((dep) => {
      const depData = fdWithFunctions.find((f) => f.path === dep);
      if (!depData) throw new Error(`Dependency ${dep} not found`);
      depData.functions.forEach((func) => {
        functions.push(func);
      });
    });
    return {
      ...data,
      functions,
    };
  });

  // Gets contracts
  const fdWithContracts = fdWithFunctionDependencies.map((data) => {
    const fc = getFileCache(cache, data.path);
    const contracts =
      data.changed || !fc
        ? getSkittlesContracts(data.ast, data.interfaces, data.constants, data.functions)
        : fc.contracts;
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
