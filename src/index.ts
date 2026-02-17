#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { compileCommand } from "./commands/compile.ts";
import { cleanCommand } from "./commands/clean.ts";
import { initCommand } from "./commands/init.ts";
import { testCommand } from "./commands/test.ts";
import { printLogo } from "./utils/console.ts";

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
  .command(
    "test",
    "Compile contracts and run tests with vitest",
    (yargs) => {
      return yargs.option("watch", {
        alias: "w",
        type: "boolean",
        description: "Run vitest in watch mode",
        default: false,
      });
    },
    async (argv) => {
      await testCommand(process.cwd(), argv.watch as boolean);
    }
  )
  .demandCommand(1, "Please specify a command")
  .strict()
  .help()
  .version()
  .parseAsync();
