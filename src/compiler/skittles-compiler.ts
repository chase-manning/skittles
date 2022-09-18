import ora from "ora";
import getAbi from "../abi/get-abi";
import getBytecode from "../bytecode/get-bytecode";
import { readFile, writeBuildFile } from "../helpers/file-helper";
import SkittlesContract from "../types/skittles-contract";
import getYul from "../yul/get-yul";
import getFileData, { FileData } from "./get-file-data";

const doTask = (task: string, fn: () => any) => {
  const spinner = ora(task).start();
  const response = fn();
  spinner.succeed();
  return response;
};

const skittlesCompile = () => {
  // Loading cache
  const cache = JSON.parse(readFile("build/cache.json"));

  // Getting file data
  const fileData: FileData[] = doTask("Processing Files", () => getFileData(cache));

  // Compiling Contracts
  fileData.forEach((fd) => {
    fd.contracts.forEach((contract: SkittlesContract) => {
      const { name } = contract;
      doTask(`Compiling ${name}`, () => {
        const abi = getAbi(contract);
        writeBuildFile(`${name}.abi`, JSON.stringify(abi, null, 2), "abi");
        const yul = getYul(contract, abi);
        writeBuildFile(`${name}.yul`, yul, "yul");
        const bytecode = getBytecode(name, yul);
        writeBuildFile(`${name}.bytecode`, bytecode, "bytecode");
      });
    });
  });
};

export default skittlesCompile;
