"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_1 = require("typescript");
const skittles_expression_1 = require("../types/skittles-expression");
const getSkittlesOperator = (syntaxKind) => {
    switch (syntaxKind) {
        case typescript_1.SyntaxKind.PlusToken:
            return skittles_expression_1.SkittlesOperator.Plus;
        case typescript_1.SyntaxKind.MinusToken:
            return skittles_expression_1.SkittlesOperator.Minus;
        case typescript_1.SyntaxKind.AsteriskToken:
            return skittles_expression_1.SkittlesOperator.Multiply;
        case typescript_1.SyntaxKind.SlashToken:
            return skittles_expression_1.SkittlesOperator.Divide;
        case typescript_1.SyntaxKind.PercentToken:
            return skittles_expression_1.SkittlesOperator.Modulo;
        case typescript_1.SyntaxKind.AmpersandAmpersandToken:
            return skittles_expression_1.SkittlesOperator.And;
        case typescript_1.SyntaxKind.BarBarToken:
            return skittles_expression_1.SkittlesOperator.Or;
        case typescript_1.SyntaxKind.EqualsEqualsToken:
            return skittles_expression_1.SkittlesOperator.Equals;
        case typescript_1.SyntaxKind.EqualsEqualsEqualsToken:
            return skittles_expression_1.SkittlesOperator.Equals;
        case typescript_1.SyntaxKind.ExclamationEqualsToken:
            return skittles_expression_1.SkittlesOperator.NotEquals;
        case typescript_1.SyntaxKind.ExclamationEqualsEqualsToken:
            return skittles_expression_1.SkittlesOperator.NotEquals;
        case typescript_1.SyntaxKind.LessThanToken:
            return skittles_expression_1.SkittlesOperator.LessThan;
        case typescript_1.SyntaxKind.LessThanEqualsToken:
            return skittles_expression_1.SkittlesOperator.LessThanOrEqual;
        case typescript_1.SyntaxKind.GreaterThanToken:
            return skittles_expression_1.SkittlesOperator.GreaterThan;
        case typescript_1.SyntaxKind.GreaterThanEqualsToken:
            return skittles_expression_1.SkittlesOperator.GreaterThanOrEqual;
        case typescript_1.SyntaxKind.AsteriskAsteriskToken:
            return skittles_expression_1.SkittlesOperator.Power;
        default:
            throw new Error(`Unknown syntax kind: ${syntaxKind}`);
    }
};
exports.default = getSkittlesOperator;
