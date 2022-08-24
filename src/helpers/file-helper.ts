import path from "path";
import fs from "fs";

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

export const getAllContractFiles = (): string[] => {
  return getAllFilesInDirectory(CONTRCT_PATH)
    .filter((file) => {
      return fs.statSync(file).isFile();
    })
    .filter((file) => {
      return (
        file.endsWith(".ts") &&
        !file.endsWith(".d.ts") &&
        !file.endsWith(".spec.ts")
      );
    });
};

const DIR = "build";

export const writeFile = (type: string, fileName: string, content: string) => {
  const directory = `${DIR}/${type}`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(`${directory}/${fileName}.${type}`, content);
};

// Delete all files and directories in the given directory
export const clearDirectory = (directory: string) => {
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
  return file.substring(
    contractIndex + 6,
    file.indexOf(" ", contractIndex + 6)
  );
};
