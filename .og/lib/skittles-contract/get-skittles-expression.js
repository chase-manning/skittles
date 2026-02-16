"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_1 = require("typescript");
const ast_helper_1 = require("../helpers/ast-helper");
const skittles_type_1 = require("../types/skittles-type");
const skittles_expression_1 = require("../types/skittles-expression");
const get_skittles_operator_1 = __importDefault(require("./get-skittles-operator"));
const get_skittles_type_1 = __importDefault(require("./get-skittles-type"));
const getIdentifierExpression = (expression, constants) => {
    // Handling if it's a global constant
    const variable = expression.escapedText;
    if (variable && constants[variable]) {
        const constant = constants[variable];
        if (constant)
            return constant;
    }
    // Handling if it's some local variable
    return {
        expressionType: skittles_expression_1.SkittlesExpressionType.Variable,
        value: expression.escapedText,
    };
};
const getLiteralExpression = (expression, interfaces) => {
    const value = expression.text;
    return {
        expressionType: skittles_expression_1.SkittlesExpressionType.Value,
        type: (0, get_skittles_type_1.default)(expression, interfaces, value),
        value,
    };
};
const getPropertyAccessExpression = (expression, interfaces, constants) => {
    if (expression.expression.kind === typescript_1.SyntaxKind.PropertyAccessExpression) {
        const property = (0, ast_helper_1.getNodeName)(expression);
        switch (property) {
            case "length":
                return {
                    expressionType: skittles_expression_1.SkittlesExpressionType.Length,
                    value: getSkittlesExpression(expression.expression, interfaces, constants),
                };
            default:
                throw new Error(`Unknown property access property: ${property}`);
        }
    }
    if (expression.expression.kind === typescript_1.SyntaxKind.ThisKeyword) {
        return {
            expressionType: skittles_expression_1.SkittlesExpressionType.Storage,
            variable: (0, ast_helper_1.getNodeName)(expression),
        };
    }
    if (expression.expression.kind === typescript_1.SyntaxKind.Identifier) {
        const environment = expression.expression.escapedText;
        if (!environment)
            throw new Error("Could not get environment");
        if (["block", "chain", "msg", "tx"].includes(environment)) {
            return {
                expressionType: skittles_expression_1.SkittlesExpressionType.EvmDialect,
                environment: environment,
                variable: (0, ast_helper_1.getNodeName)(expression),
            };
        }
        if (environment === "Number") {
            const element = (0, ast_helper_1.getNodeName)(expression.name);
            if (element === "MAX_SAFE_INTEGER" || element === "MAX_VALUE") {
                return {
                    expressionType: skittles_expression_1.SkittlesExpressionType.Value,
                    type: {
                        kind: skittles_type_1.SkittlesTypeKind.Number,
                    },
                    value: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                };
            }
            throw new Error(`Could not get value for ${element}`);
        }
        throw new Error(`Unknown environment: ${environment}`);
    }
    throw new Error(`Property access expression not supported ${expression.kind}`);
};
const getBinaryExpression = (expression, interfaces, constants) => {
    return {
        expressionType: skittles_expression_1.SkittlesExpressionType.Binary,
        left: getSkittlesExpression(expression.left, interfaces, constants),
        right: getSkittlesExpression(expression.right, interfaces, constants),
        operator: (0, get_skittles_operator_1.default)(expression.operatorToken.kind),
    };
};
const getElementAccessExpression = (expression, interfaces, constants) => {
    let e = expression;
    const items = [];
    while ((0, typescript_1.isElementAccessExpression)(e)) {
        items.unshift(getSkittlesExpression(e.argumentExpression, interfaces, constants));
        e = e.expression;
    }
    return {
        expressionType: skittles_expression_1.SkittlesExpressionType.Mapping,
        variable: (0, ast_helper_1.getNodeName)(e),
        items,
    };
};
const getPrefixUnaryExpression = (expression, interfaces, constants) => {
    return {
        expressionType: skittles_expression_1.SkittlesExpressionType.Not,
        value: getSkittlesExpression(expression.operand, interfaces, constants),
    };
};
const getBooleanExpression = (item) => {
    return {
        expressionType: skittles_expression_1.SkittlesExpressionType.Value,
        type: { kind: skittles_type_1.SkittlesTypeKind.Void },
        value: item ? "true" : "false",
    };
};
const getThisExpression = () => {
    return {
        expressionType: skittles_expression_1.SkittlesExpressionType.This,
    };
};
const getNewExpression = (expression, interfaces, constants) => {
    var _a;
    return {
        expressionType: skittles_expression_1.SkittlesExpressionType.Deploy,
        contract: (0, ast_helper_1.getNodeName)(expression.expression),
        parameters: ((_a = expression.arguments) === null || _a === void 0 ? void 0 : _a.map((arg) => getSkittlesExpression(arg, interfaces, constants))) || [],
    };
};
const getConditionalExpression = (expression, interfaces, constants) => {
    return {
        expressionType: skittles_expression_1.SkittlesExpressionType.Conditional,
        condition: getSkittlesExpression(expression.condition, interfaces, constants),
        trueValue: getSkittlesExpression(expression.whenTrue, interfaces, constants),
        falseValue: getSkittlesExpression(expression.whenFalse, interfaces, constants),
    };
};
const getCallExpression = (expression, interfaces, constants) => {
    const callExpression = expression.expression;
    const target = (0, ast_helper_1.getNodeName)(callExpression);
    // Hash Function
    if (target === "hash") {
        return {
            expressionType: skittles_expression_1.SkittlesExpressionType.Hash,
            inputs: expression.arguments.map((e) => getSkittlesExpression(e, interfaces, constants)),
        };
    }
    // Internal Functions
    if ((0, typescript_1.isPropertyAccessExpression)(callExpression)) {
        return {
            expressionType: skittles_expression_1.SkittlesExpressionType.Call,
            target,
            element: getSkittlesExpression(callExpression.expression, interfaces, constants),
            parameters: expression.arguments.map((e) => getSkittlesExpression(e, interfaces, constants)),
        };
    }
    // External Functions
    if ((0, typescript_1.isIdentifier)(callExpression)) {
        return {
            expressionType: skittles_expression_1.SkittlesExpressionType.Call,
            target,
            element: {
                expressionType: skittles_expression_1.SkittlesExpressionType.External,
            },
            parameters: expression.arguments.map((e) => getSkittlesExpression(e, interfaces, constants)),
        };
    }
    throw new Error(`Unknown return call expression type ${callExpression.kind}`);
};
const getSkittlesExpression = (expression, interfaces, constants) => {
    if ((0, typescript_1.isIdentifier)(expression)) {
        return getIdentifierExpression(expression, constants);
    }
    if ((0, typescript_1.isLiteralExpression)(expression)) {
        return getLiteralExpression(expression, interfaces);
    }
    if ((0, typescript_1.isPropertyAccessExpression)(expression)) {
        return getPropertyAccessExpression(expression, interfaces, constants);
    }
    if ((0, typescript_1.isBinaryExpression)(expression)) {
        return getBinaryExpression(expression, interfaces, constants);
    }
    if ((0, typescript_1.isElementAccessExpression)(expression)) {
        return getElementAccessExpression(expression, interfaces, constants);
    }
    if ((0, typescript_1.isParenthesizedExpression)(expression)) {
        return getSkittlesExpression(expression.expression, interfaces, constants);
    }
    if ((0, typescript_1.isPrefixUnaryExpression)(expression)) {
        return getPrefixUnaryExpression(expression, interfaces, constants);
    }
    if ((0, ast_helper_1.isTrueKeyword)(expression)) {
        return getBooleanExpression(true);
    }
    if ((0, ast_helper_1.isFalseKeyword)(expression)) {
        return getBooleanExpression(false);
    }
    if (expression.kind === typescript_1.SyntaxKind.ThisKeyword) {
        return getThisExpression();
    }
    if ((0, typescript_1.isNewExpression)(expression)) {
        return getNewExpression(expression, interfaces, constants);
    }
    if ((0, typescript_1.isConditionalExpression)(expression)) {
        return getConditionalExpression(expression, interfaces, constants);
    }
    if ((0, typescript_1.isCallExpression)(expression)) {
        return getCallExpression(expression, interfaces, constants);
    }
    throw new Error(`Unknown expression type: ${expression.kind}`);
};
exports.default = getSkittlesExpression;
