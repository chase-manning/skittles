#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { compileCommand } from "./commands/compile";
import { cleanCommand } from "./commands/clean";
import { initCommand } from "./commands/init";
import { printLogo } from "./utils/console";

printLogo();

yargs(hideBin(process.argv))
  .scriptName("skittles")
  .usage("$0 <command> [options]")
  .command(
    "compile",
    "Compile TypeScript contracts to EVM bytecode",
    () => {},
    async () => {
      await compileCommand(process.cwd());
    }
  )
  .command(
    "clean",
    "Remove build artifacts",
    () => {},
    async () => {
      await cleanCommand(process.cwd());
    }
  )
  .command(
    "init",
    "Initialize a new Skittles project",
    () => {},
    async () => {
      await initCommand(process.cwd());
    }
  )
  .demandCommand(1, "Please specify a command")
  .strict()
  .help()
  .version()
  .parse();
