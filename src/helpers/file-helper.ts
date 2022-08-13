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
