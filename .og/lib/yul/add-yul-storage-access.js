"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yul_template_1 = require("../data/yul-template");
const string_helper_1 = require("../helpers/string-helper");
const yul_helper_1 = require("../helpers/yul-helper");
const skittles_type_1 = require("../types/skittles-type");
const skittles_expression_1 = require("../types/skittles-expression");
const skittles_statement_1 = require("../types/skittles-statement");
const get_expression_yul_1 = __importDefault(require("./get-expression-yul"));
const _addStorageAccess = (yul, property, section, contract) => {
    const { name, type } = property;
    const initial = `_${name.substring(0, 1)}`;
    // Handling Immutable variables
    if (property.immutable) {
        let { value } = property;
        if (!value) {
            if (!contract.constructor) {
                throw new Error("No constructor to get storage value");
            }
            contract.constructor.statements.forEach((statement) => {
                const { statementType } = statement;
                if (statementType === skittles_statement_1.SkittlesStatementType.StorageUpdate) {
                    if (statement.variable === name) {
                        if (statement.value.expressionType !== skittles_expression_1.SkittlesExpressionType.Value) {
                            throw new Error("Issue setting readonly from constructor `setimmutable` not implemented yet");
                        }
                        value = statement.value;
                    }
                }
            });
        }
        if (!value)
            throw new Error("No storage update to get storage value");
        return (0, yul_helper_1.addToSection)(yul, section, [
            `function ${name}Storage() -> ${initial} {`,
            `${initial} := ${(0, get_expression_yul_1.default)(value)}`,
            `}`,
        ]);
    }
    // Handling Mappings
    if (type.kind === skittles_type_1.SkittlesTypeKind.Mapping) {
        const vars = (0, string_helper_1.getVariables)(type.inputs.length);
        return (0, yul_helper_1.addToSection)(yul, section, [
            `function ${name}Storage(${vars}) -> ${initial} {`,
            `${initial} := sload(${name}Pos(${vars}))`,
            `}`,
            `function ${name}Set(${vars}, value) {`,
            `sstore(${name}Pos(${vars}), value)`,
            `}`,
        ]);
    }
    // Handling Arrays
    if (type.kind === skittles_type_1.SkittlesTypeKind.Array) {
        return (0, yul_helper_1.addToSection)(yul, section, [
            `function ${name}LengthStorage() -> ${initial} {`,
            `${initial} := sload(${name}LengthPos())`,
            `}`,
            `function ${name}IndexStorage(value) -> ${initial} {`,
            `if gte(value, ${name}LengthStorage()) { revert(0, 0) }`,
            `${initial} := sload(add(${name}ArrayPos(), value))`,
            `}`,
            `function ${name}Storage() -> l {`,
            `l := ${name}LengthStorage()`,
            `for { let j := 0} lt(j, l) { j := add(j, 1) } { mstore(j, ${name}IndexStorage(j)) }`,
            `}`,
            `function ${name}Push(value) {`,
            `let length := ${name}LengthStorage()`,
            `if gt(length, 18446744073709551614) { revert(0, 0) }`,
            `sstore(add(length, ${name}ArrayPos()), value)`,
            `sstore(${name}LengthPos(), add(length, 1))`,
            `}`,
        ]);
    }
    // Handling normal variables
    return (0, yul_helper_1.addToSection)(yul, section, [
        `function ${name}Storage() -> ${initial} {`,
        `${initial} := sload(${name}Pos())`,
        `}`,
        `function ${name}Set(value) {`,
        `sstore(${name}Pos(), value)`,
        `}`,
    ]);
};
const addStorageAccess = (yul, property, contract) => {
    return _addStorageAccess(_addStorageAccess(yul, property, yul_template_1.YulSection.ConstructorStorageAccess, contract), property, yul_template_1.YulSection.StorageAccess, contract);
};
exports.default = addStorageAccess;
