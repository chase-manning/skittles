#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { cleanCommand } from "./commands/clean.ts";
import { compileCommand, watchCompile } from "./commands/compile.ts";
import { initCommand } from "./commands/init.ts";
import { logError, printLogo } from "./utils/console.ts";
import { getErrorMessage } from "./utils/error.ts";
import { getPackageVersion } from "./utils/package.ts";

let packageVersion: string;
try {
  packageVersion = getPackageVersion();
} catch (err) {
  const message = getErrorMessage(err);
  logError(`Failed to read package.json: ${message}`);
  process.exit(1);
}

printLogo();

yargs(hideBin(process.argv))
  .scriptName("skittles")
  .usage("$0 <command> [options]")
  .command(
    "compile",
    "Compile TypeScript contracts to Solidity",
    (yargs) =>
      yargs.option("watch", {
        alias: "w",
        type: "boolean",
        default: false,
        describe: "Watch for file changes and recompile automatically",
      }),
    async (argv) => {
      if (argv.watch) {
        await watchCompile(process.cwd());
      } else {
        await compileCommand(process.cwd());
      }
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
      yargs.option("install", {
        type: "boolean",
        default: true,
        describe:
          "Install dependencies automatically (use --no-install to skip)",
      }),
    async (argv) => {
      await initCommand(process.cwd(), { install: argv.install });
    }
  )
  .demandCommand(1, "Please specify a command")
  .strict()
  .help()
  .version(packageVersion)
  .parseAsync();
