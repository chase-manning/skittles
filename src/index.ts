#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { compileCommand } from "./commands/compile.ts";
import { cleanCommand } from "./commands/clean.ts";
import { initCommand } from "./commands/init.ts";
import { printLogo } from "./utils/console.ts";

printLogo();

yargs(hideBin(process.argv))
  .scriptName("skittles")
  .usage("$0 <command> [options]")
  .command(
    "compile",
    "Compile TypeScript contracts to Solidity",
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
    (yargs) =>
      yargs.option("no-install", {
        type: "boolean",
        default: false,
        describe: "Skip automatic dependency installation",
      }),
    async (argv) => {
      await initCommand(process.cwd(), { install: !argv.noInstall });
    }
  )
  .demandCommand(1, "Please specify a command")
  .strict()
  .help()
  .version()
  .parseAsync();
