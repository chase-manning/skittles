#!/usr/bin/env node

import yargs from "yargs";
import { clearDirectory } from "./helpers/file-helper";
import { address, self, block, chain, msg, tx } from "./types/core-types";
import getSkittlesFactory from "./testing/get-skittles-factory";
import { logSkittles } from "./helpers/console-helper";
import skittlesCompile from "./compiler/skittles-compiler";
import { ZERO_ADDRESS } from "./data/constants";

yargs
  .command(
    "compile",
    "Compile all TypeScript files",
    async (): Promise<void> => {
      logSkittles();
      skittlesCompile();
    }
  )
  .command("clean", "Clears the cache and deletes all builds", (): void => {
    clearDirectory("./build");
  })
  .parse();

export {
  address,
  self,
  block,
  chain,
  msg,
  tx,
  getSkittlesFactory,
  ZERO_ADDRESS,
};
