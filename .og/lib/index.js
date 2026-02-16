#!/usr/bin/env node --wasm-dynamic-tiering
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hash = exports.ZERO_ADDRESS = exports.getSkittlesFactory = exports.tx = exports.msg = exports.chain = exports.block = exports.self = void 0;
const yargs_1 = __importDefault(require("yargs"));
const file_helper_1 = require("./helpers/file-helper");
const core_types_1 = require("./types/core-types");
Object.defineProperty(exports, "self", { enumerable: true, get: function () { return core_types_1.self; } });
Object.defineProperty(exports, "block", { enumerable: true, get: function () { return core_types_1.block; } });
Object.defineProperty(exports, "chain", { enumerable: true, get: function () { return core_types_1.chain; } });
Object.defineProperty(exports, "msg", { enumerable: true, get: function () { return core_types_1.msg; } });
Object.defineProperty(exports, "tx", { enumerable: true, get: function () { return core_types_1.tx; } });
Object.defineProperty(exports, "hash", { enumerable: true, get: function () { return core_types_1.hash; } });
const get_skittles_factory_1 = __importDefault(require("./testing/get-skittles-factory"));
exports.getSkittlesFactory = get_skittles_factory_1.default;
const console_helper_1 = require("./helpers/console-helper");
const skittles_compiler_1 = __importDefault(require("./compiler/skittles-compiler"));
const constants_1 = require("./data/constants");
Object.defineProperty(exports, "ZERO_ADDRESS", { enumerable: true, get: function () { return constants_1.ZERO_ADDRESS; } });
const init_1 = require("./commands/init");
yargs_1.default
    .command("compile", "Compile all TypeScript files", async () => {
    (0, console_helper_1.logSkittles)();
    (0, skittles_compiler_1.default)();
})
    .command("clean", "Clears the cache and deletes all builds", () => {
    (0, file_helper_1.clearDirectory)("./build");
})
    .command("init", "Initialize a new Skittles project", (yargs) => {
    return yargs.option("force", {
        alias: "f",
        type: "boolean",
        description: "Overwrite existing skittles.config.ts and contract files if they exist",
    });
}, (argv) => {
    try {
        (0, init_1.initSkittles)({
            force: argv.force,
        });
    }
    catch (error) {
        console.error((error === null || error === void 0 ? void 0 : error.message) || "Failed to initialize project");
        process.exit(1);
    }
})
    .parse();
