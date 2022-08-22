#!/usr/bin/env node
// import chalk from "chalk";
// import clear from "clear";
// import figlet from "figlet";
// import path from "path";
import { program } from "commander";
import getAbi from "./abi/get-abi";
import getBytecode from "./bytecode/get-bytecode";
import { getAllContractFiles, writeFile } from "./helpers/file-helper";
import getSkittlesClass from "./skittles-class/get-skittles-class";
import getYul from "./yul/get-yul";

// clear();
// console.log(
//   chalk.red(figlet.textSync("skittles-cli", { horizontalLayout: "full" }))
// );

program
  .name("skittles")
  .description("CLI for the Skittles compiler")
  .version("0.1.0");

// program
//   .command("compile")
//   .description("Compile TypeScript file")
//   .argument("<string>", "file name")
//   .action(async (str, options) => {
//     console.log(await compileTypeScriptToBytecode(str));
//   });

program
  .command("compile")
  .description("Compile all TypeScript file")
  .action(async () => {
    await skittlesCompile();
  });

program.parse();

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
