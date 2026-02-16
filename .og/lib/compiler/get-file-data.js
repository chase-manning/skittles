"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const get_ast_1 = require("../ast/get-ast");
const constants_1 = require("../data/constants");
const ast_helper_1 = require("../helpers/ast-helper");
const file_helper_1 = require("../helpers/file-helper");
const string_helper_1 = require("../helpers/string-helper");
const get_skittles_constants_1 = __importDefault(require("../skittles-contract/get-skittles-constants"));
const get_skittles_contracts_1 = __importDefault(require("../skittles-contract/get-skittles-contracts"));
const get_skittles_functions_1 = __importDefault(require("../skittles-contract/get-skittles-functions"));
const get_skittles_interfaces_1 = __importDefault(require("../skittles-contract/get-skittles-interfaces"));
const dependency_merger_1 = require("./dependency-merger");
const getFileCache = (cache, filePath) => {
    if (!cache)
        return null;
    if (!cache.version)
        return null;
    if (cache.version !== constants_1.CACHE_VERSION)
        return null;
    if (!cache.files)
        return null;
    if (!cache.files[filePath])
        return null;
    return cache.files[filePath];
};
const getData = (cache, filePaths, filesAdded) => {
    if (filePaths.length === 0)
        return [];
    const fileData = [];
    filePaths.forEach((path) => {
        if (filesAdded.includes(path))
            return;
        const fileContent = (0, file_helper_1.readFile)(path);
        const hash = (0, string_helper_1.hashString)(fileContent);
        const fc = getFileCache(cache, path);
        const changed = (fc === null || fc === void 0 ? void 0 : fc.hash) !== hash;
        const ast = changed ? (0, get_ast_1.getAstFromFile)(fileContent) : fc.ast;
        const dependencies = changed ? (0, ast_helper_1.getDependencies)(ast, path) : fc.dependencies;
        filesAdded.push(path);
        fileData.push({
            path,
            hash,
            fileContent,
            changed,
            dependencies,
            ast,
            constants: {},
            interfaces: {},
            contracts: [],
            functions: [],
        });
    });
    fileData.push(...getData(cache, fileData.flatMap((fd) => fd.dependencies), filesAdded));
    return fileData;
};
const getBaseFileData = (cache) => {
    const fileData = [];
    const contractFiles = (0, file_helper_1.getAllTypescriptFiles)();
    fileData.push(...getData(cache, contractFiles, []));
    return fileData;
};
/**
 * Gets data from cache if available and unchanged, otherwise computes it.
 */
const getCachedOrComputed = (cache, data, cacheGetter, computeFn) => {
    const fc = getFileCache(cache, data.path);
    return data.changed || !fc ? computeFn() : cacheGetter(fc);
};
const getFileData = (cache) => {
    const baseFileData = getBaseFileData(cache);
    // Updates data if a dependency has changed
    const updatedFileData = baseFileData.map((data) => {
        if (data.changed)
            return data;
        const changed = data.dependencies.some((dependency) => {
            const depData = baseFileData.find((f) => f.path === dependency);
            if (!depData)
                throw new Error(`Dependency ${dependency} not found`);
            return depData.changed;
        });
        const ast = changed ? (0, get_ast_1.getAstFromFile)(data.fileContent) : data.ast;
        const dependencies = changed ? (0, ast_helper_1.getDependencies)(ast, data.path) : data.dependencies;
        return {
            ...data,
            ast,
            dependencies,
            changed,
        };
    });
    // Gets interfaces
    const fdWithInterfaces = updatedFileData.map((data) => {
        const interfaces = getCachedOrComputed(cache, data, (fc) => fc.interfaces, () => (0, get_skittles_interfaces_1.default)(data.ast));
        return {
            ...data,
            interfaces,
        };
    });
    const fdWithInterfaceDependencies = (0, dependency_merger_1.mergeInterfaces)(fdWithInterfaces);
    // Gets constants
    const fdWithConstants = fdWithInterfaceDependencies.map((data) => {
        const constants = getCachedOrComputed(cache, data, (fc) => fc.constants, () => (0, get_skittles_constants_1.default)(data.ast, data.interfaces));
        return {
            ...data,
            constants,
        };
    });
    const fdWithConstantDependencies = (0, dependency_merger_1.mergeConstants)(fdWithConstants);
    // Gets functions
    const fdWithFunctions = fdWithConstantDependencies.map((data) => {
        const functions = getCachedOrComputed(cache, data, (fc) => fc.functions, () => (0, get_skittles_functions_1.default)(data.ast, data.interfaces, data.constants, []));
        return {
            ...data,
            functions,
        };
    });
    const fdWithFunctionDependencies = (0, dependency_merger_1.mergeFunctions)(fdWithFunctions);
    // Gets contracts
    const fdWithContracts = fdWithFunctionDependencies.map((data) => {
        const contracts = getCachedOrComputed(cache, data, (fc) => fc.contracts, () => (0, get_skittles_contracts_1.default)(data.ast, data.interfaces, data.constants, data.functions));
        return {
            ...data,
            contracts,
        };
    });
    // Add extensions to contracts
    const fdWithContractExtensions = fdWithContracts.map((data) => {
        if (!data.changed)
            return data;
        const contracts = data.contracts.map((contract) => {
            const { events, variables, methods } = contract;
            contract.extensions.forEach((extension) => {
                const exContract = fdWithContracts
                    .map((f) => f.contracts)
                    .flat()
                    .find((c) => c.name === extension);
                if (exContract) {
                    events.push(...exContract.events);
                    variables.push(...exContract.variables);
                    methods.push(...exContract.methods);
                }
            });
            return {
                ...contract,
                events,
                variables,
                methods,
            };
        });
        return {
            ...data,
            contracts,
        };
    });
    return fdWithContractExtensions;
};
exports.default = getFileData;
