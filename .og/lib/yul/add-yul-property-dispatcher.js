"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yul_template_1 = require("../data/yul-template");
const selector_helper_1 = require("../helpers/selector-helper");
const yul_helper_1 = require("../helpers/yul-helper");
const skittles_type_1 = require("../types/skittles-type");
const yul_constants_1 = require("./yul-constants");
const addPropertyDispatcher = (yul, abi, property) => {
    if (property.private)
        return yul;
    const { name, type } = property;
    const selector = (0, selector_helper_1.getFunctionSelector)(abi, name);
    // Handling Mappings
    if (type.kind === skittles_type_1.SkittlesTypeKind.Mapping) {
        const inputTypes = type.inputs.map((input) => {
            return input.kind;
        });
        return (0, yul_helper_1.addToSection)(yul, yul_template_1.YulSection.Dispatchers, [
            `case ${selector} /* "${name}(${inputTypes.join(", ")})" */ {`,
            `${yul_constants_1.returnFunctions[type.output.kind]}(${name}Storage(${inputTypes
                .map((t, i) => `${yul_constants_1.decoderFunctions[t]}(${i})`)
                .join(", ")}))`,
            `}`,
        ]);
    }
    // Handling Arrays
    if (type.kind === skittles_type_1.SkittlesTypeKind.Array) {
        return (0, yul_helper_1.addToSection)(yul, yul_template_1.YulSection.Dispatchers, [
            `case ${selector} /* "${name}(uint256)" */ {`,
            `${yul_constants_1.returnFunctions[type.itemType.kind]}(${name}IndexStorage(decodeAsUint(0)))`,
            `}`,
        ]);
    }
    // Handle normal variables
    return (0, yul_helper_1.addToSection)(yul, yul_template_1.YulSection.Dispatchers, [
        `case ${selector} /* "${name}()" */ {`,
        `${yul_constants_1.returnFunctions[type.kind]}(${name}Storage())`,
        `}`,
    ]);
};
exports.default = addPropertyDispatcher;
