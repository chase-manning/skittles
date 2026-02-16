"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_1 = require("typescript");
const get_skittles_method_1 = require("./get-skittles-method");
const getSkittlesFunctions = (ast, interfaces, constants, events) => {
    const functions = [];
    (0, typescript_1.forEachChild)(ast, (child) => {
        if ((0, typescript_1.isVariableStatement)(child)) {
            const { declarations } = child.declarationList;
            declarations.forEach((declaration) => {
                const { initializer } = declaration;
                if (initializer) {
                    if ((0, typescript_1.isArrowFunction)(initializer)) {
                        functions.push((0, get_skittles_method_1.getSkittlesMethodFromArrowFunction)(declaration, interfaces, constants, events));
                    }
                }
            });
        }
        if ((0, typescript_1.isFunctionDeclaration)(child)) {
            functions.push((0, get_skittles_method_1.getSkittlesMethodFromFunctionDeclaration)(child, interfaces, constants, events));
        }
    });
    return functions;
};
exports.default = getSkittlesFunctions;
