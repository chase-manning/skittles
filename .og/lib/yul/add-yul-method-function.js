"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yul_template_1 = require("../data/yul-template");
const yul_helper_1 = require("../helpers/yul-helper");
const skittles_type_1 = require("../types/skittles-type");
const get_block_yul_1 = __importDefault(require("./get-block-yul"));
const addMethodFunction = (yul, method, external) => {
    const { name, parameters, returns, statements } = method;
    const returnVariables = () => {
        if (returns.kind === skittles_type_1.SkittlesTypeKind.Void)
            return "";
        if (returns.kind === skittles_type_1.SkittlesTypeKind.Interface) {
            return `-> ${returns.interface.elements.map((e) => `_${e.name}Var`).join(", ")} `;
        }
        return "-> v ";
    };
    const yuls = [
        `function ${name}${external ? "External" : ""}Function(${parameters
            .map((input) => `${input.name}Var`)
            .join(", ")}) ${returnVariables()}{`,
        ...(0, get_block_yul_1.default)(statements),
        `}`,
    ];
    return (0, yul_helper_1.addToSection)((0, yul_helper_1.addToSection)(yul, yul_template_1.YulSection.Functions, yuls), yul_template_1.YulSection.ConstructorFunctions, yuls);
};
exports.default = addMethodFunction;
