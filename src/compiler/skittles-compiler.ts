import ora from "ora";
import getAbi from "../abi/get-abi";
import getBytecode from "../bytecode/get-bytecode";
import addDependencies from "../dependencies/add-dependencies";
import { getAllContractFiles, writeFile } from "../helpers/file-helper";
import getSkittlesContract from "../skittles-contract/get-skittles-contract";
import SkittlesContract from "../types/skittles-contract";
import getYul from "../yul/get-yul";

const doTask = (task: string, fn: () => any) => {
  const spinner = ora(task).start();
  const response = fn();
  spinner.succeed();
  return response;
};

const skittlesCompile = () => {
  const files = doTask("Loading Contracts", () => getAllContractFiles());
  const classes = doTask("Processing", () => files.map(getSkittlesContract));
  classes.forEach((contract: SkittlesContract) => {
    const { name } = contract;
    doTask(`Compiling ${name}`, () => {
      const newClass = addDependencies(contract, classes);
      const abi = getAbi(newClass);
      writeFile("abi", name, JSON.stringify(abi, null, 2));
      const yul = getYul(newClass, abi);
      writeFile("yul", name, yul);
      const bytecode = getBytecode(name, yul);
      writeFile("bytecode", name, bytecode);
    });
  });
};

export default skittlesCompile;
