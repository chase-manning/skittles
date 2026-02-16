"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const getFileString = (fileName) => {
    return fs_1.default.readFileSync(fileName, { encoding: "utf8" });
};
const getSkittlesFactory = async (signer, contract) => {
    const abi = JSON.parse(getFileString(path_1.default.join(process.cwd(), `build/abi/${contract}.abi`)));
    const bytecode = getFileString(path_1.default.join(process.cwd(), `build/bytecode/${contract}.bytecode`));
    return new ethers_1.ContractFactory(abi, bytecode, signer);
};
exports.default = getSkittlesFactory;
