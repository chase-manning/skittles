#!/usr/bin/env node
// import figlet from "figlet";
import yargs from "yargs";
import getAbi from "./abi/get-abi";
import getBytecode from "./bytecode/get-bytecode";
import {
  clearDirectory,
  getAllContractFiles,
  writeFile,
} from "./helpers/file-helper";
import getSkittlesClass from "./skittles-class/get-skittles-class";
import getYul from "./yul/get-yul";
import { address, self, block, chain, msg, tx } from "./types/core-types";
import getSkittlesFactory from "./testing/get-skittles-factory";
import { logSkittles } from "./helpers/console-helper";

const skittlesCompile = async () => {
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

yargs
  .command("compile", "Compile all TypeScript files", async () => {
    logSkittles();
    await skittlesCompile();
  })
  .command("clean", "Clears the cache and deletes all builds", () => {
    clearDirectory("./build");
  })
  .parse();

export { address, self, block, chain, msg, tx, getSkittlesFactory };
