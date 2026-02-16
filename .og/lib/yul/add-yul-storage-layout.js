"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yul_template_1 = require("../data/yul-template");
const string_helper_1 = require("../helpers/string-helper");
const yul_helper_1 = require("../helpers/yul-helper");
const skittles_type_1 = require("../types/skittles-type");
const _addStorageLayout = (yul, property, contract, section, slot) => {
    if (property.immutable)
        return { yul, slot: slot + 1 };
    const { name, type } = property;
    // Handling Mappings
    if (type.kind === skittles_type_1.SkittlesTypeKind.Mapping) {
        const matchingMappings = contract.variables.filter((v) => {
            return (v.type.kind === skittles_type_1.SkittlesTypeKind.Mapping && v.type.inputs.length === type.inputs.length);
        });
        const index = matchingMappings.findIndex((v) => v.name === property.name);
        const variables = (0, string_helper_1.getVariables)(type.inputs.length);
        const extraVars = variables.split(", ").slice(1);
        const extraVarsYul = [
            `mstore(0, p)`,
            ...extraVars.map((v, index) => `mstore(0x${index * 20}, ${v})`),
            `p := keccak256(0, 0x${type.inputs.length * 20})`,
        ];
        return {
            yul: (0, yul_helper_1.addToSection)(yul, section, [
                `function ${name}Pos(${variables}) -> p {`,
                `p := add(0x${index + 1}000, a)`,
                ...(extraVars.length > 0 ? extraVarsYul : []),
                `}`,
            ]),
            slot,
        };
    }
    // Handling Arrays
    if (type.kind === skittles_type_1.SkittlesTypeKind.Array) {
        yul = (0, yul_helper_1.addToSection)(yul, section, [`function ${name}LengthPos() -> p { p := ${slot} }`]);
        yul = (0, yul_helper_1.addToSection)(yul, section, [`function ${name}ArrayPos() -> p { p := ${slot + 1} }`]);
        return {
            yul,
            slot: slot + 2 ** 64,
        };
    }
    // Handle normal variables
    return {
        yul: (0, yul_helper_1.addToSection)(yul, section, [`function ${name}Pos() -> p { p := ${slot} }`]),
        slot: slot + 1,
    };
};
const addStorageLayout = (yul, property, contract, slot) => {
    const response = _addStorageLayout(yul, property, contract, yul_template_1.YulSection.ConstructorStorageLayout, slot);
    return _addStorageLayout(response.yul, property, contract, yul_template_1.YulSection.StorageLayout, slot);
};
exports.default = addStorageLayout;
