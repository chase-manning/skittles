"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const skittles_expression_1 = require("../types/skittles-expression");
const skittles_statement_1 = require("../types/skittles-statement");
const get_expression_yul_1 = __importDefault(require("./get-expression-yul"));
const getStorageUpdateYul = (statement) => {
    const { variable, value } = statement;
    return [`${variable}Set(${(0, get_expression_yul_1.default)(value)})`];
};
const getReturnYul = (statement) => {
    const { value } = statement;
    if (value.expressionType === skittles_expression_1.SkittlesExpressionType.Interface) {
        return [
            ...value.interface.elements.map((e) => {
                return `_${e.name}Var := ${(0, get_expression_yul_1.default)(value.values[e.name])}`;
            }),
        ];
    }
    return [`v := ${(0, get_expression_yul_1.default)(value)}`];
};
const getMappingUpdateYul = (statement) => {
    const { variable, items, value } = statement;
    const variables = items.map((item) => (0, get_expression_yul_1.default)(item));
    return [`${variable}Set(${variables.join(", ")}, ${(0, get_expression_yul_1.default)(value)})`];
};
const getExpressionStatementYul = (statement) => {
    const { expression } = statement;
    return [`${(0, get_expression_yul_1.default)(expression)}`];
};
const getIfYul = (statement) => {
    const { condition, then } = statement;
    const statements = [];
    for (const statement of then) {
        statements.push(...getStatementYul(statement));
    }
    if (statement.else.length === 0) {
        return [`if ${(0, get_expression_yul_1.default)(condition)} {`, ...statements, `}`];
    }
    const elseStatements = [];
    for (const s of statement.else) {
        elseStatements.push(...getStatementYul(s));
    }
    return [
        `switch ${(0, get_expression_yul_1.default)(condition)}`,
        `case true {`,
        ...statements,
        `}`,
        `case false {`,
        ...elseStatements,
        `}`,
    ];
};
const getThrowYul = (statement) => {
    const { error } = statement;
    return [`revert256(${(0, get_expression_yul_1.default)(error)})`];
};
const getVariableDeclarationYul = (statement) => {
    const { variable, value } = statement;
    return [`let ${variable}Var := ${(0, get_expression_yul_1.default)(value)}`];
};
const getVariableUpdateYul = (statement) => {
    const { variable, value } = statement;
    return [`${variable}Var := ${(0, get_expression_yul_1.default)(value)}`];
};
const getEmitEventYul = (statement) => {
    const { event, values } = statement;
    return [`emit${event.label}Event(${values.map(get_expression_yul_1.default).join(", ")})`];
};
const getStatementYul = (statement) => {
    switch (statement.statementType) {
        case skittles_statement_1.SkittlesStatementType.StorageUpdate:
            return getStorageUpdateYul(statement);
        case skittles_statement_1.SkittlesStatementType.Return:
            return getReturnYul(statement);
        case skittles_statement_1.SkittlesStatementType.MappingUpdate:
            return getMappingUpdateYul(statement);
        case skittles_statement_1.SkittlesStatementType.Expression:
            return getExpressionStatementYul(statement);
        case skittles_statement_1.SkittlesStatementType.If:
            return getIfYul(statement);
        case skittles_statement_1.SkittlesStatementType.Throw:
            return getThrowYul(statement);
        case skittles_statement_1.SkittlesStatementType.VariableDeclaration:
            return getVariableDeclarationYul(statement);
        case skittles_statement_1.SkittlesStatementType.VariableUpdate:
            return getVariableUpdateYul(statement);
        case skittles_statement_1.SkittlesStatementType.EmitEvent:
            return getEmitEventYul(statement);
        default:
            throw new Error(`Unsupported statement type ${statement.statementType}`);
    }
};
exports.default = getStatementYul;
