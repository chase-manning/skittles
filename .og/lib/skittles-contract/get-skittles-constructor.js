"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ast_helper_1 = require("../helpers/ast-helper");
const get_skittles_statements_1 = __importDefault(require("./get-skittles-statements"));
const get_skittles_type_1 = __importDefault(require("./get-skittles-type"));
const getSkittlesConstructor = (astConstructor, interfaces, constants, events) => {
    return {
        parameters: astConstructor.parameters.map((parameter) => {
            return {
                name: (0, ast_helper_1.getNodeName)(parameter),
                type: (0, get_skittles_type_1.default)(parameter.type, interfaces),
            };
        }),
        statements: (0, get_skittles_statements_1.default)(astConstructor.body, (0, get_skittles_type_1.default)(astConstructor.type, interfaces), interfaces, constants, events),
    };
};
exports.default = getSkittlesConstructor;
