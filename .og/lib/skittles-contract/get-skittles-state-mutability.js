"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const skittles_type_1 = require("../types/skittles-type");
const skittles_statement_1 = require("../types/skittles-statement");
const skittles_expression_1 = require("../types/skittles-expression");
const getMethod = (target, contract) => {
    const method = contract.methods.find((m) => m.name === target);
    if (!method)
        throw new Error(`Method ${target} not found`);
    return method;
};
const methodModifiesState = (method, contract) => {
    if (method.returns.kind === skittles_type_1.SkittlesTypeKind.Void)
        return true;
    for (const statement of method.statements) {
        const { statementType } = statement;
        if (statementType === skittles_statement_1.SkittlesStatementType.MappingUpdate)
            return true;
        if (statementType === skittles_statement_1.SkittlesStatementType.StorageUpdate)
            return true;
        if (statementType === skittles_statement_1.SkittlesStatementType.Expression) {
            const { expression } = statement;
            if (expression.expressionType === skittles_expression_1.SkittlesExpressionType.Call) {
                const target = getMethod(expression.target, contract);
                if (methodModifiesState(target, contract))
                    return true;
            }
        }
    }
    return false;
};
const getStateMutability = (contract) => {
    for (let method of contract.methods) {
        method.view = !methodModifiesState(method, contract);
    }
    return contract;
};
exports.default = getStateMutability;
