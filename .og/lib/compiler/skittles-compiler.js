"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ora_1 = __importDefault(require("ora"));
require("ts-node/register");
const get_abi_1 = __importDefault(require("../abi/get-abi"));
const get_bytecode_1 = __importDefault(require("../bytecode/get-bytecode"));
const file_helper_1 = require("../helpers/file-helper");
const get_yul_1 = __importDefault(require("../yul/get-yul"));
const get_file_data_1 = __importDefault(require("./get-file-data"));
const path_1 = __importDefault(require("path"));
const type_check_helper_1 = require("../helpers/type-check-helper");
const doTask = (task, fn) => {
    const spinner = (0, ora_1.default)(task).start();
    const response = fn();
    spinner.succeed();
    return response;
};
const getConfig = () => {
    try {
        return require(`${process.cwd()}/skittles.config.ts`);
    }
    catch {
        throw new Error("No skittles.config.ts file found");
    }
};
const getCache = () => {
    const cachePath = path_1.default.join(process.cwd(), "build/cache.json");
    const cacheContent = (0, file_helper_1.readFile)(cachePath);
    // If file doesn't exist or is empty, return empty cache
    if (!cacheContent || cacheContent.trim() === "" || cacheContent === "{}") {
        return {
            version: "",
            files: {},
        };
    }
    // Try to parse the cache file
    try {
        const parsed = JSON.parse(cacheContent);
        // Validate basic structure
        if (typeof parsed === "object" && parsed !== null) {
            return {
                version: parsed.version || "",
                files: parsed.files || {},
            };
        }
        // If structure is invalid, return empty cache
        return {
            version: "",
            files: {},
        };
    }
    catch (error) {
        // If JSON is malformed, return empty cache
        // This allows compilation to continue with a fresh cache
        return {
            version: "",
            files: {},
        };
    }
};
/**
 * Checks if a contract needs to be recompiled by comparing file hashes and dependencies.
 */
const needsRecompilation = (contractName, fileData) => {
    // Check if any file containing this contract or its dependencies has changed
    const contractFile = fileData.find((fd) => fd.contracts.some((c) => c.name === contractName));
    if (!contractFile)
        return true;
    if (contractFile.changed)
        return true;
    // Check if any dependency has changed
    return contractFile.dependencies.some((dep) => {
        const depFile = fileData.find((f) => f.path === dep);
        return (depFile === null || depFile === void 0 ? void 0 : depFile.changed) || false;
    });
};
/**
 * Collects all contracts that need compilation.
 */
const collectContractsToCompile = (fileData) => {
    const contractsToCompile = [];
    fileData.forEach((fd) => {
        fd.contracts.forEach((contract) => {
            if (needsRecompilation(contract.name, fileData)) {
                contractsToCompile.push({ contract, fileData: fd });
            }
        });
    });
    return contractsToCompile;
};
const skittlesCompile = () => {
    try {
        // Loading cache and config
        const cache = getCache();
        const config = getConfig();
        // Type checking (if enabled)
        if (config.typeCheck !== false) {
            doTask("Type Checking", () => {
                (0, type_check_helper_1.typeCheckContracts)(config);
            });
        }
        // Getting file data
        const fileData = doTask("Processing Files", () => {
            return (0, get_file_data_1.default)(cache);
        });
        // Updating cache
        try {
            (0, file_helper_1.updateCache)(fileData);
        }
        catch (error) {
            throw new Error(`Failed to update cache: ${(error === null || error === void 0 ? void 0 : error.message) || "Unknown error"}`);
        }
        // Collect contracts that need compilation (incremental compilation)
        const contractsToCompile = collectContractsToCompile(fileData);
        if (contractsToCompile.length === 0) {
            console.log("✓ All contracts are up to date");
            return;
        }
        // Compile contracts sequentially (Yul mode only supports one file at a time)
        // But we still benefit from incremental compilation - only compiling what changed
        contractsToCompile.forEach(({ contract }, index) => {
            const { name } = contract;
            const progress = contractsToCompile.length > 1 ? `[${index + 1}/${contractsToCompile.length}] ` : "";
            doTask(`${progress}Compiling ${name}`, () => {
                try {
                    const abi = (0, get_abi_1.default)(contract);
                    (0, file_helper_1.writeBuildFile)(`${name}.abi`, JSON.stringify(abi, null, 2), "abi");
                    const yul = (0, get_yul_1.default)(contract, abi);
                    (0, file_helper_1.writeBuildFile)(`${name}.yul`, yul, "yul");
                    const bytecode = (0, get_bytecode_1.default)(name, yul, config);
                    (0, file_helper_1.writeBuildFile)(`${name}.bytecode`, bytecode, "bytecode");
                }
                catch (error) {
                    throw new Error(`Failed to compile contract "${name}": ${(error === null || error === void 0 ? void 0 : error.message) || "Unknown error"}`);
                }
            });
        });
    }
    catch (error) {
        throw new Error(`Compilation failed: ${(error === null || error === void 0 ? void 0 : error.message) || "Unknown error"}`);
    }
};
exports.default = skittlesCompile;
