"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ast_helper_1 = require("../helpers/ast-helper");
const get_skittles_events_1 = require("./get-skittles-events");
const get_skittles_expression_1 = __importDefault(require("./get-skittles-expression"));
const get_skittles_type_1 = __importDefault(require("./get-skittles-type"));
const getSkittlesVariables = (astPropertes, interfaces, constants) => {
    const vars = [];
    for (const astProperty of astPropertes) {
        const { type } = astProperty;
        if (!type)
            throw new Error("Could not get property type");
        if ((0, get_skittles_events_1.isEvent)(type))
            continue;
        const initializer = astProperty.initializer;
        const value = initializer
            ? (0, get_skittles_expression_1.default)(initializer, interfaces, constants)
            : undefined;
        vars.push({
            name: (0, ast_helper_1.getNodeName)(astProperty),
            type: (0, get_skittles_type_1.default)(type, interfaces, value),
            value,
            private: (0, ast_helper_1.isNodePrivate)(astProperty),
            immutable: (0, ast_helper_1.isNodeImmutable)(astProperty),
        });
    }
    return vars;
};
exports.default = getSkittlesVariables;
