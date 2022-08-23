import path from "path";
import fs from "fs";

const CONTRCT_PATH = "./contracts";

export const getAllContractFiles = (): string[] => {
  return fs
    .readdirSync(CONTRCT_PATH)
    .filter((file) => {
      return fs.statSync(path.join(CONTRCT_PATH, file)).isFile();
    })
    .map((file) => {
      return path.join(CONTRCT_PATH, file);
    })
    .filter((file) => {
      return file.endsWith(".ts") || file.endsWith(".js");
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
