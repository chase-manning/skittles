"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const skittles_type_1 = require("../types/skittles-type");
const skittles_expression_1 = require("../types/skittles-expression");
const yul_constants_1 = require("./yul-constants");
const getBinaryYul = (expression) => {
    const { left, right, operator } = expression;
    switch (operator) {
        case skittles_expression_1.SkittlesOperator.Plus:
            return `safeAdd(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
        case skittles_expression_1.SkittlesOperator.Minus:
            return `safeSub(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
        case skittles_expression_1.SkittlesOperator.Multiply:
            return `safeMul(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
        case skittles_expression_1.SkittlesOperator.Divide:
            return `div(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
        case skittles_expression_1.SkittlesOperator.Modulo:
            return `mod(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
        case skittles_expression_1.SkittlesOperator.Equals:
            return `eq(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
        case skittles_expression_1.SkittlesOperator.NotEquals:
            return `neq(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
        case skittles_expression_1.SkittlesOperator.GreaterThan:
            return `gt(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
        case skittles_expression_1.SkittlesOperator.LessThan:
            return `lt(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
        case skittles_expression_1.SkittlesOperator.GreaterThanOrEqual:
            return `gte(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
        case skittles_expression_1.SkittlesOperator.LessThanOrEqual:
            return `lte(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
        case skittles_expression_1.SkittlesOperator.And:
            return `and(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
        case skittles_expression_1.SkittlesOperator.Or:
            return `or(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
        case skittles_expression_1.SkittlesOperator.Power:
            return `exp(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
        default:
            throw new Error(`Unsupported binary operator ${operator}`);
    }
};
const getCallYul = (expression) => {
    const { target, parameters, element } = expression;
    switch (element.expressionType) {
        case skittles_expression_1.SkittlesExpressionType.This:
            return `${target}Function(${parameters.map(getExpressionYul).join(", ")})`;
        case skittles_expression_1.SkittlesExpressionType.Storage:
            switch (target) {
                case "push":
                    return `${element.variable}Push(${parameters.map(getExpressionYul).join()})`;
                default:
                    throw new Error(`Unsupported storage function ${target}`);
            }
        case skittles_expression_1.SkittlesExpressionType.External:
            return `${target}ExternalFunction(${parameters.map(getExpressionYul).join(", ")})`;
        default:
            throw new Error(`Unsupported expression type ${element.expressionType}`);
    }
};
const getExpressionYul = (expression) => {
    switch (expression.expressionType) {
        case skittles_expression_1.SkittlesExpressionType.Not:
            return `iszero(${getExpressionYul(expression.value)})`;
        case skittles_expression_1.SkittlesExpressionType.Binary:
            return getBinaryYul(expression);
        case skittles_expression_1.SkittlesExpressionType.Variable:
            return `${expression.value}Var`;
        case skittles_expression_1.SkittlesExpressionType.Value:
            const { type } = expression;
            if (type.kind === skittles_type_1.SkittlesTypeKind.String)
                return `add("${expression.value}", ${expression.value.length * 2})`;
            return expression.value;
        case skittles_expression_1.SkittlesExpressionType.Storage:
            return `${expression.variable}Storage()`;
        case skittles_expression_1.SkittlesExpressionType.Mapping:
            const variables = expression.items.map((item) => getExpressionYul(item));
            return `${expression.variable}Storage(${variables.join(", ")})`;
        case skittles_expression_1.SkittlesExpressionType.EvmDialect:
            return yul_constants_1.evmDialects[expression.environment][expression.variable];
        case skittles_expression_1.SkittlesExpressionType.Interface:
            return `{ ${expression.interface.elements
                .map((e) => expression.values[e.name])
                .join(", ")} }`;
        case skittles_expression_1.SkittlesExpressionType.Length:
            const { value } = expression;
            switch (value.expressionType) {
                case skittles_expression_1.SkittlesExpressionType.Storage:
                    return `${value.variable}LengthStorage()`;
                default:
                    throw new Error(`Unsupported length expression type ${value.expressionType}`);
            }
        case skittles_expression_1.SkittlesExpressionType.Call:
            return getCallYul(expression);
        case skittles_expression_1.SkittlesExpressionType.Hash:
            const { inputs } = expression;
            return `hash${inputs.length}Vars(${inputs.map(getExpressionYul).join(", ")})`;
        default:
            throw new Error(`Unsupported expression: ${expression.expressionType}`);
    }
};
exports.default = getExpressionYul;
