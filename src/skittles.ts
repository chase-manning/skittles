import getAbi from "./abi/get-abi";
import getBytecode from "./bytecode/get-bytecode";
import getSkittlesClass from "./skittles-class/get-skittles-class";
import getYul from "./yul/get-yul";
import { getAllContractFiles, writeFile } from "./helpers/file-helper";

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
