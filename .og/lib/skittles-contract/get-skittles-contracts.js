"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_1 = require("typescript");
const ast_helper_1 = require("../helpers/ast-helper");
const get_skittles_constructor_1 = __importDefault(require("./get-skittles-constructor"));
const get_skittles_events_1 = __importDefault(require("./get-skittles-events"));
const get_skittles_method_1 = __importDefault(require("./get-skittles-method"));
const get_skittles_state_mutability_1 = __importDefault(require("./get-skittles-state-mutability"));
const get_skittles_variables_1 = __importDefault(require("./get-skittles-variables"));
const getSkittlesContracts = (ast, interfaces, constants, functions) => {
    const classNodes = (0, ast_helper_1.getClassNodes)(ast);
    return classNodes.map((classNode) => {
        const astVariables = classNode.members.filter(typescript_1.isPropertyDeclaration).filter(ast_helper_1.isVariable);
        const astMethods = classNode.members.filter(typescript_1.isMethodDeclaration);
        const astArrowFunctions = classNode.members
            .filter(typescript_1.isPropertyDeclaration)
            .filter(ast_helper_1.isPropertyArrowFunction);
        const astConstructor = classNode.members.find(typescript_1.isConstructorDeclaration);
        const extensions = [];
        const { heritageClauses } = classNode;
        if (heritageClauses) {
            heritageClauses.forEach((heritageClause) => {
                heritageClause.types.forEach((type) => {
                    extensions.push((0, ast_helper_1.getNodeName)(type.expression));
                });
            });
        }
        const events = (0, get_skittles_events_1.default)(astVariables, interfaces);
        const variables = (0, get_skittles_variables_1.default)(astVariables, interfaces, constants);
        const contract = {
            extensions,
            constants,
            interfaces,
            events,
            name: (0, ast_helper_1.getNodeName)(classNode),
            constructor: astConstructor
                ? (0, get_skittles_constructor_1.default)(astConstructor, interfaces, constants, events)
                : undefined,
            variables,
            methods: [
                ...astMethods.map((m) => (0, get_skittles_method_1.default)(m, interfaces, constants, events)),
                ...astArrowFunctions.map((f) => (0, get_skittles_method_1.default)(f, interfaces, constants, events)),
            ],
            functions,
        };
        return (0, get_skittles_state_mutability_1.default)(contract);
    });
};
exports.default = getSkittlesContracts;
