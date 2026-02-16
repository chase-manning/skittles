#!/usr/bin/env node --wasm-dynamic-tiering
import { SkittlesEvent, address, self, block, chain, msg, tx, hash, bytes } from "./types/core-types";
import getSkittlesFactory from "./testing/get-skittles-factory";
import { ZERO_ADDRESS } from "./data/constants";
export { address, bytes, self, block, chain, msg, tx, getSkittlesFactory, ZERO_ADDRESS, SkittlesEvent, hash, };
