"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.relativePathToAbsolute = exports.getContractName = exports.clearDirectory = exports.readFile = exports.writeBuildFile = exports.updateCache = exports.getAllTypescriptFiles = exports.getAllFilesInDirectory = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const constants_1 = require("../data/constants");
const CONTRCT_PATH = path_1.default.join(process.cwd(), "contracts");
const getAllFilesInDirectory = (dir) => {
    const files = [];
    fs_1.default.readdirSync(dir).forEach((file) => {
        const filePath = path_1.default.join(dir, file);
        if (fs_1.default.statSync(filePath).isDirectory()) {
            files.push(...(0, exports.getAllFilesInDirectory)(filePath));
        }
        else {
            files.push(filePath);
        }
    });
    return files;
};
exports.getAllFilesInDirectory = getAllFilesInDirectory;
const getAllTypescriptFiles = () => {
    return (0, exports.getAllFilesInDirectory)(CONTRCT_PATH)
        .filter((file) => fs_1.default.statSync(file).isFile() &&
        file.endsWith(".ts") &&
        !file.endsWith(".d.ts") &&
        !file.endsWith(".spec.ts"))
        .map((file) => path_1.default.resolve(file));
};
exports.getAllTypescriptFiles = getAllTypescriptFiles;
const updateCache = (fileData) => {
    const files = {};
    fileData.forEach((file) => {
        files[file.path] = {
            hash: file.hash,
            dependencies: file.dependencies,
            ast: file.ast,
            contracts: file.contracts,
            interfaces: file.interfaces,
            constants: file.constants,
            functions: file.functions,
        };
    });
    const cache = {
        version: constants_1.CACHE_VERSION,
        files,
    };
    (0, exports.writeBuildFile)("cache.json", JSON.stringify(cache, null, 2));
};
exports.updateCache = updateCache;
const DIR = "build";
const writeBuildFile = (fileName, content, subDirectory) => {
    const directory = subDirectory ? `${DIR}/${subDirectory}` : DIR;
    fs_1.default.mkdirSync(directory, { recursive: true });
    fs_1.default.writeFileSync(`${directory}/${fileName}`, content);
};
exports.writeBuildFile = writeBuildFile;
const readFile = (filePath) => {
    try {
        return fs_1.default.readFileSync(filePath, "utf8");
    }
    catch (e) {
        return "{}";
    }
};
exports.readFile = readFile;
// Delete all files and directories in the given directory
const clearDirectory = (directory) => {
    if (!fs_1.default.existsSync(directory))
        return;
    const files = fs_1.default.readdirSync(directory);
    for (const file of files) {
        const filePath = path_1.default.join(directory, file);
        if (fs_1.default.statSync(filePath).isFile()) {
            fs_1.default.unlinkSync(filePath);
        }
        else {
            (0, exports.clearDirectory)(filePath);
        }
    }
    fs_1.default.rmdirSync(directory);
};
exports.clearDirectory = clearDirectory;
const getContractName = (fileName) => {
    const file = fs_1.default.readFileSync(fileName, { encoding: "utf8" });
    const contractIndex = file.indexOf("class");
    if (contractIndex === -1)
        throw new Error(`No contract in file ${file}`);
    return file.substring(contractIndex + 6, file.indexOf(" ", contractIndex + 6));
};
exports.getContractName = getContractName;
const relativePathToAbsolute = (importPath, sourcePath) => {
    if (importPath.startsWith(".")) {
        return path_1.default.resolve(path_1.default.dirname(sourcePath), importPath) + ".ts";
    }
    return importPath;
};
exports.relativePathToAbsolute = relativePathToAbsolute;
