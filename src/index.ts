#!/usr/bin/env node

import yargs from "yargs";
import getAbi from "./abi/get-abi";
import getBytecode from "./bytecode/get-bytecode";
import {
  clearDirectory,
  getAllContractFiles,
  getContractName,
  writeFile,
} from "./helpers/file-helper";
import getSkittlesClass from "./skittles-class/get-skittles-class";
import getYul from "./yul/get-yul";
import { address, self, block, chain, msg, tx } from "./types/core-types";
import getSkittlesFactory from "./testing/get-skittles-factory";
import { logSkittles } from "./helpers/console-helper";
import ora from "ora";

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

yargs
  .command("compile", "Compile all TypeScript files", async () => {
    logSkittles();
    skittlesCompile();
  })
  .command("clean", "Clears the cache and deletes all builds", () => {
    clearDirectory("./build");
  })
  .parse();

export { address, self, block, chain, msg, tx, getSkittlesFactory };
