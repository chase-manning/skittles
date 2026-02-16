"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yul_template_1 = require("../data/yul-template");
const selector_helper_1 = require("../helpers/selector-helper");
const yul_helper_1 = require("../helpers/yul-helper");
const skittles_type_1 = require("../types/skittles-type");
const yul_constants_1 = require("./yul-constants");
const addMethodDispatcher = (yul, abi, method) => {
    if (method.private)
        return yul;
    const { name, parameters, returns } = method;
    const selector = (0, selector_helper_1.getFunctionSelector)(abi, name);
    if (returns.kind === skittles_type_1.SkittlesTypeKind.Mapping) {
        throw new Error("Unexpected type kind 5");
    }
    const functionInputs = parameters
        .map((input, index) => `${yul_constants_1.decoderFunctions[input.type.kind]}(${index})`)
        .join(", ");
    const functionCall = () => {
        if (returns.kind === skittles_type_1.SkittlesTypeKind.Interface) {
            const { elements } = returns.interface;
            return [
                `let${elements
                    .map((e) => ` _${e.name}Var`)
                    .join(",")} := ${name}Function(${functionInputs})`,
                ...elements.map((e, index) => `mstore(${index * 32}, _${e.name}Var)`),
                `return(0, ${32 * elements.length})`,
            ];
        }
        if (returns.kind === skittles_type_1.SkittlesTypeKind.Void) {
            return [`${name}Function(${functionInputs})`];
        }
        return [`${yul_constants_1.returnFunctions[returns.kind]}(${name}Function(${functionInputs}))`];
    };
    return (0, yul_helper_1.addToSection)(yul, yul_template_1.YulSection.Dispatchers, [
        `case ${selector} /* "${name}(${parameters
            .map((p) => {
            return p.type.kind;
        })
            .join(", ")})" */ {`,
        ...functionCall(),
        `}`,
    ]);
};
exports.default = addMethodDispatcher;
