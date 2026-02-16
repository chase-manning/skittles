"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yul_template_1 = require("../data/yul-template");
const yul_helper_1 = require("../helpers/yul-helper");
const skittles_statement_1 = require("../types/skittles-statement");
const get_block_yul_1 = __importDefault(require("./get-block-yul"));
const getParameters = (parameters, className) => {
    return [
        `let programSize := datasize("${className}")`,
        `let argSize := sub(codesize(), programSize)`,
        `codecopy(0, programSize, argSize)`,
        ...parameters.map((input, index) => `let ${input.name}Var := mload(${index * 32})`),
    ];
};
const addConstructor = (yul, contract) => {
    const { constructor } = contract;
    if (!constructor)
        return yul;
    let { parameters, statements } = constructor;
    parameters = parameters || [];
    statements = statements || [];
    statements = statements.filter((statement) => {
        const { statementType } = statement;
        if (statementType !== skittles_statement_1.SkittlesStatementType.StorageUpdate)
            return true;
        const variable = contract.variables.find((v) => v.name === statement.variable);
        if (!variable)
            throw new Error(`No variable found for ${statement.variable}`);
        return !variable.immutable;
    });
    return (0, yul_helper_1.addToSection)(yul, yul_template_1.YulSection.Constructor, [
        ...getParameters(parameters, contract.name),
        ...(0, get_block_yul_1.default)(statements),
    ]);
};
exports.default = addConstructor;
