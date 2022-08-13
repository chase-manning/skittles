import getAbi from "./get-abi";
import getBytecode from "./get-bytecode";
import getSkittlesClass from "./get-skittles-class";
import getYul from "./get-yul";
import { getAllContractFiles } from "./helpers/file-helper";
import fs from "fs";

const DIR = "build";

const writeFile = (type: string, fileName: string, content: string) => {
  const directory = `${DIR}/${type}`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(`${directory}/${fileName}.${type}`, content);
};

export const skittlesCompile = async () => {
  const files = getAllContractFiles();
  const promises = files.map(async (file) => {
    const skittlesClass = getSkittlesClass(file);
    const abi = getAbi(skittlesClass);
    const { name } = skittlesClass;
    writeFile("abi", name, JSON.stringify(abi, null, 2));
    const yul = getYul(skittlesClass, abi);
    writeFile("yul", name, yul);
    const bytecode = getBytecode(name, yul);
    writeFile("bytecode", name, bytecode);
  });
  await Promise.all(promises);
};
