import ora from "ora";
import getAbi from "../abi/get-abi";
import getBytecode from "../bytecode/get-bytecode";
import addDependencies from "../dependencies/add-dependencies";
import {
  getAllContractFiles,
  readFile,
  writeBuildFile,
} from "../helpers/file-helper";
import { hashString } from "../helpers/string-helper";
import getSkittlesContracts from "../skittles-contract/get-skittles-contracts";
import SkittlesCache from "../types/skittles-cache";
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
  const contracts = doTask("Processing", () => {
    const cache = JSON.parse(readFile("build/cache.json"));
    const newCache: SkittlesCache = { files: {} };
    const contracts_: SkittlesContract[] = [];
    files.forEach((file: string) => {
      const fileContent = readFile(file);
      const hash = hashString(fileContent);
      const filesContracts = getSkittlesContracts(file, hash, cache);
      contracts_.push(...filesContracts);
      newCache.files[file] = { hash, contracts: filesContracts };
    });
    writeBuildFile("cache.json", JSON.stringify(newCache, null, 2));
    return contracts_;
  });
  contracts.forEach((contract: SkittlesContract) => {
    const { name } = contract;
    doTask(`Compiling ${name}`, () => {
      const newClass = addDependencies(contract, contracts);
      const abi = getAbi(newClass);
      writeBuildFile(`${name}.abi`, JSON.stringify(abi, null, 2), "abi");
      const yul = getYul(newClass, abi);
      writeBuildFile(`${name}.yul`, yul, "yul");
      const bytecode = getBytecode(name, yul);
      writeBuildFile(`${name}.bytecode`, bytecode, "bytecode");
    });
  });
};

export default skittlesCompile;
