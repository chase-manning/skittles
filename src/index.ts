#!/usr/bin/env node
import chalk from "chalk";
import clear from "clear";
import figlet from "figlet";
import path from "path";
import { program } from "commander";
import { compileTypeScriptToBytecode } from "./compiler";
import { getAllContractFiles } from "./helpers/file-helper";

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
  .action(async (str, options) => {
    const files = getAllContractFiles();
    const promises = files.map(async (file) => {
      console.log(await compileTypeScriptToBytecode(file));
    });
    await Promise.all(promises);
  });

program.parse();
