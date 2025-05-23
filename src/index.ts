#!/usr/bin/env node --wasm-dynamic-tiering

import yargs from "yargs";
import { clearDirectory } from "./helpers/file-helper";
import {
  SkittlesEvent,
  address,
  self,
  block,
  chain,
  msg,
  tx,
  hash,
  bytes,
} from "./types/core-types";
import getSkittlesFactory from "./testing/get-skittles-factory";
import { logSkittles } from "./helpers/console-helper";
import skittlesCompile from "./compiler/skittles-compiler";
import { ZERO_ADDRESS } from "./data/constants";

yargs
  .command("compile", "Compile all TypeScript files", async (): Promise<void> => {
    logSkittles();
    skittlesCompile();
  })
  .command("clean", "Clears the cache and deletes all builds", (): void => {
    clearDirectory("./build");
  })
  .parse();

export {
  address,
  bytes,
  self,
  block,
  chain,
  msg,
  tx,
  getSkittlesFactory,
  ZERO_ADDRESS,
  SkittlesEvent,
  hash,
};
