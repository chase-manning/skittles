"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSkittlesMethodFromFunctionDeclaration = exports.getSkittlesMethodFromArrowFunction = void 0;
const typescript_1 = require("typescript");
const ast_helper_1 = require("../helpers/ast-helper");
const get_skittles_statements_1 = __importDefault(require("./get-skittles-statements"));
const get_skittles_type_1 = __importDefault(require("./get-skittles-type"));
const getSkittlesParameters = (node, interfaces) => {
    const inputs = [];
    (0, typescript_1.forEachChild)(node, (node) => {
        if ((0, typescript_1.isParameter)(node)) {
            inputs.push({
                name: (0, ast_helper_1.getNodeName)(node),
                type: (0, get_skittles_type_1.default)(node.type, interfaces),
            });
        }
    });
    return inputs;
};
const getSkittlesMethodFromArrowFunction = (astMethod, interfaces, constants, events) => {
    if (!astMethod.initializer || !(0, typescript_1.isArrowFunction)(astMethod.initializer)) {
        throw new Error("Expected initializer to be an ArrowFunction");
    }
    const arrowFunction = astMethod.initializer;
    return {
        name: (0, ast_helper_1.getNodeName)(astMethod),
        returns: (0, get_skittles_type_1.default)(arrowFunction.type, interfaces),
        private: (0, ast_helper_1.isNodePrivate)(astMethod),
        view: false,
        parameters: getSkittlesParameters(arrowFunction, interfaces),
        statements: (0, get_skittles_statements_1.default)(arrowFunction.body, (0, get_skittles_type_1.default)(arrowFunction.type, interfaces), interfaces, constants, events),
    };
};
exports.getSkittlesMethodFromArrowFunction = getSkittlesMethodFromArrowFunction;
const getSkittlesMethodFromFunctionDeclaration = (astMethod, interfaces, constants, events) => {
    return {
        name: (0, ast_helper_1.getNodeName)(astMethod),
        returns: (0, get_skittles_type_1.default)(astMethod.type, interfaces),
        private: (0, ast_helper_1.isNodePrivate)(astMethod),
        view: false,
        parameters: getSkittlesParameters(astMethod, interfaces),
        statements: (0, get_skittles_statements_1.default)(astMethod.body, (0, get_skittles_type_1.default)(astMethod.type, interfaces), interfaces, constants, events),
    };
};
exports.getSkittlesMethodFromFunctionDeclaration = getSkittlesMethodFromFunctionDeclaration;
const getSkittlesMethod = (astMethod, interfaces, constants, events) => {
    // Is normal function
    if ((0, typescript_1.isMethodDeclaration)(astMethod)) {
        return (0, exports.getSkittlesMethodFromFunctionDeclaration)(astMethod, interfaces, constants, events);
    }
    // Is arrow function
    if (astMethod.initializer && (0, typescript_1.isArrowFunction)(astMethod.initializer)) {
        return (0, exports.getSkittlesMethodFromArrowFunction)(astMethod, interfaces, constants, events);
    }
    throw new Error("Method type is not supported");
};
exports.default = getSkittlesMethod;
