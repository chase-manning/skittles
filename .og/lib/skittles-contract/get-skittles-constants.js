"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_1 = require("typescript");
const ast_helper_1 = require("../helpers/ast-helper");
const get_skittles_expression_1 = __importDefault(require("./get-skittles-expression"));
const getSkittlesConstants = (ast, interfaces) => {
    const constants = {};
    (0, typescript_1.forEachChild)(ast, (child) => {
        if ((0, typescript_1.isVariableStatement)(child)) {
            const { declarations } = child.declarationList;
            declarations.forEach((declaration) => {
                const { name, initializer } = declaration;
                if (initializer) {
                    if (!(0, typescript_1.isArrowFunction)(initializer)) {
                        const variableName = (0, ast_helper_1.getNodeName)(name);
                        constants[variableName] = (0, get_skittles_expression_1.default)(initializer, interfaces, constants);
                    }
                }
            });
        }
    });
    return constants;
};
exports.default = getSkittlesConstants;
