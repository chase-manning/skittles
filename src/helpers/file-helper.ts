import path from "path";
import fs from "fs";
import SkittlesCache, { FileCache } from "../types/skittles-cache";
import { FileData } from "../compiler/get-file-data";
import { CACHE_VERSION } from "../data/constants";

const CONTRCT_PATH = "./contracts";

export const getAllFilesInDirectory = (dir: string) => {
  const files: string[] = [];
  fs.readdirSync(dir).forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      files.push(...getAllFilesInDirectory(filePath));
    } else {
      files.push(filePath);
    }
  });
  return files;
};

export const getAllTypescriptFiles = () => {
  return getAllFilesInDirectory(CONTRCT_PATH)
    .filter(
      (file) =>
        fs.statSync(file).isFile() &&
        file.endsWith(".ts") &&
        !file.endsWith(".d.ts") &&
        !file.endsWith(".spec.ts")
    )
    .map((file) => path.resolve(file));
};

export const updateCache = (fileData: FileData[]) => {
  const files: Record<string, FileCache> = {};
  fileData.forEach((file) => {
    files[file.path] = {
      hash: file.hash,
      dependencies: file.dependencies,
      ast: file.ast,
      contracts: file.contracts,
      interfaces: file.interfaces,
      constants: file.constants,
      functions: file.functions,
    };
  });

  const cache: SkittlesCache = {
    version: CACHE_VERSION,
    files,
  };
  writeBuildFile("cache.json", JSON.stringify(cache, null, 2));
};

const DIR = "build";

export const writeBuildFile = (fileName: string, content: string, subDirectory?: string) => {
  const directory = subDirectory ? `${DIR}/${subDirectory}` : DIR;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(`${directory}/${fileName}`, content);
};

export const readFile = (filePath: string): string => {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    return "{}";
  }
};

// Delete all files and directories in the given directory
export const clearDirectory = (directory: string) => {
  if (!fs.existsSync(directory)) return;

  const files = fs.readdirSync(directory);
  for (const file of files) {
    const filePath = path.join(directory, file);
    if (fs.statSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
    } else {
      clearDirectory(filePath);
    }
  }
  fs.rmdirSync(directory);
};

export const getContractName = (fileName: string) => {
  const file = fs.readFileSync(fileName, { encoding: "utf8" });
  const contractIndex = file.indexOf("class");
  if (contractIndex === -1) throw new Error(`No contract in file ${file}`);
  return file.substring(contractIndex + 6, file.indexOf(" ", contractIndex + 6));
};

export const relativePathToAbsolute = (importPath: string, sourcePath: string) => {
  if (importPath.startsWith(".")) {
    return path.resolve(path.dirname(sourcePath), importPath) + ".ts";
  }
  return importPath;
};
