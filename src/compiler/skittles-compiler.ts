import ora from "ora";
import getAbi from "../abi/get-abi";
import getBytecode from "../bytecode/get-bytecode";
import {
  getAllContractFiles,
  getContractName,
  writeFile,
} from "../helpers/file-helper";
import getSkittlesClass from "../skittles-class/get-skittles-class";
import getYul from "../yul/get-yul";

const skittlesCompile = () => {
  const filesSpinner = ora("Loading Contracts").start();
  const files = getAllContractFiles();
  filesSpinner.succeed();
  files.forEach((file) => {
    const name = getContractName(file);
    const spinner = ora(`Compiling ${name}`).start();
    const skittlesClass = getSkittlesClass(file);
    const abi = getAbi(skittlesClass);
    writeFile("abi", name, JSON.stringify(abi, null, 2));
    const yul = getYul(skittlesClass, abi);
    writeFile("yul", name, yul);
    const bytecode = getBytecode(name, yul);
    writeFile("bytecode", name, bytecode);
    spinner.succeed();
  });
};

export default skittlesCompile;
