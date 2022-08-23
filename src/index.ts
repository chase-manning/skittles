#!/usr/bin/env node
// import chalk from "chalk";
// import clear from "clear";
// import figlet from "figlet";
// import path from "path";
import { program } from "commander";
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

// clear();
// console.log(
//   chalk.red(figlet.textSync("skittles-cli", { horizontalLayout: "full" }))
// );

program
  .name("skittles")
  .description("CLI for the Skittles compiler")
  .version("0.1.0");

program
  .command("compile")
  .description("Compile all TypeScript files")
  .action(async () => {
    await skittlesCompile();
  });

program
  .command("clean")
  .description("Clears the cache and deletes all builds")
  .action(() => {
    clearDirectory("./build");
  });

program.parse();

export { address, self, block, chain, msg, tx };
