import ora from "ora";
import getAbi from "../abi/get-abi";
import getBytecode from "../bytecode/get-bytecode";
import addDependencies from "../dependencies/add-dependencies";
import {
  getAllContractFiles,
  readFile,
  writeFile,
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
  const oldCache = JSON.parse(readFile("cache.json"));
  const contracts = doTask("Processing", () => {
    const newCache: SkittlesCache = { files: {} };
    const contracts_: SkittlesContract[] = [];
    files.forEach((file: string) => {
      let filesContracts: SkittlesContract[] = [];
      const fileContent = readFile(file);
      const hash = hashString(fileContent);
      if (
        oldCache &&
        oldCache.files &&
        oldCache.files[file] &&
        oldCache.files[file].hash === hash
      ) {
        const cache = oldCache.files[file];
        filesContracts = cache.contracts;
      } else {
        filesContracts = getSkittlesContracts(file);
      }
      contracts_.push(...filesContracts);
      newCache.files[file] = { hash, contracts: filesContracts };
    });
    writeFile("cache.json", JSON.stringify(newCache, null, 2));
    return contracts_;
  });
  contracts.forEach((contract: SkittlesContract) => {
    const { name } = contract;
    doTask(`Compiling ${name}`, () => {
      const newClass = addDependencies(contract, contracts);
      const abi = getAbi(newClass);
      writeFile(`${name}.abi`, JSON.stringify(abi, null, 2), "abi");
      const yul = getYul(newClass, abi);
      writeFile(`${name}.yul`, yul, "yul");
      const bytecode = getBytecode(name, yul);
      writeFile(`${name}.bytecode`, bytecode, "bytecode");
    });
  });
};

export default skittlesCompile;
