"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_1 = require("typescript");
const ast_helper_1 = require("../helpers/ast-helper");
const skittles_type_1 = require("../types/skittles-type");
const skittles_expression_1 = require("../types/skittles-expression");
const skittles_statement_1 = require("../types/skittles-statement");
const get_skittles_expression_1 = __importDefault(require("./get-skittles-expression"));
const get_skittles_type_1 = __importDefault(require("./get-skittles-type"));
const extract_conditional_expression_statements_1 = __importDefault(require("./extract-conditional-expression-statements"));
const isNotIgnored = (statement) => {
    return statement.statementType !== skittles_statement_1.SkittlesStatementType.Ignore;
};
const getSkittlesStatements = (block, returnType, interfaces, constants, events) => {
    if (!block)
        return [];
    if ((0, typescript_1.isBlock)(block)) {
        const { statements } = block;
        const skittlesStatements = [];
        statements.forEach((statement) => {
            const skittlesStatement = getSkittlesStatement(statement, returnType, interfaces, constants, events);
            skittlesStatements.push(...skittlesStatement);
        });
        return skittlesStatements.filter(isNotIgnored);
    }
    return [...getSkittlesStatement(block, returnType, interfaces, constants, events)].filter(isNotIgnored);
};
const getReturnValue = (expression, returnType, interfaces, constants) => {
    if ((0, typescript_1.isBinaryExpression)(expression)) {
        return (0, get_skittles_expression_1.default)(expression, interfaces, constants);
    }
    if ((0, typescript_1.isPropertyAccessExpression)(expression)) {
        return (0, get_skittles_expression_1.default)(expression, interfaces, constants);
    }
    if ((0, typescript_1.isElementAccessExpression)(expression)) {
        return (0, get_skittles_expression_1.default)(expression, interfaces, constants);
    }
    if ((0, ast_helper_1.isTrueKeyword)(expression)) {
        return {
            expressionType: skittles_expression_1.SkittlesExpressionType.Value,
            type: { kind: skittles_type_1.SkittlesTypeKind.Boolean },
            value: "true",
        };
    }
    if ((0, ast_helper_1.isFalseKeyword)(expression)) {
        return {
            expressionType: skittles_expression_1.SkittlesExpressionType.Value,
            type: { kind: skittles_type_1.SkittlesTypeKind.Boolean },
            value: "false",
        };
    }
    if ((0, typescript_1.isPrefixUnaryExpression)(expression)) {
        return {
            expressionType: skittles_expression_1.SkittlesExpressionType.Not,
            value: (0, get_skittles_expression_1.default)(expression.operand, interfaces, constants),
        };
    }
    if ((0, typescript_1.isLiteralExpression)(expression)) {
        return {
            expressionType: skittles_expression_1.SkittlesExpressionType.Value,
            type: (0, get_skittles_type_1.default)(expression, interfaces),
            value: (0, ast_helper_1.getNodeName)(expression),
        };
    }
    if ((0, typescript_1.isObjectLiteralExpression)(expression)) {
        const values = {};
        if (returnType.kind !== skittles_type_1.SkittlesTypeKind.Interface) {
            throw new Error("Return type is not an interface");
        }
        expression.properties.forEach((property) => {
            if ((0, typescript_1.isPropertyAssignment)(property)) {
                values[(0, ast_helper_1.getNodeName)(property.name)] = (0, get_skittles_expression_1.default)(property.initializer, interfaces, constants);
            }
            else if ((0, typescript_1.isShorthandPropertyAssignment)(property)) {
                values[(0, ast_helper_1.getNodeName)(property.name)] = (0, get_skittles_expression_1.default)(property.name, interfaces, constants);
            }
            else {
                throw new Error("Unknown object literal property type");
            }
        });
        return {
            expressionType: skittles_expression_1.SkittlesExpressionType.Interface,
            interface: returnType.interface,
            values,
        };
    }
    if ((0, typescript_1.isIdentifier)(expression)) {
        return (0, get_skittles_expression_1.default)(expression, interfaces, constants);
    }
    if ((0, typescript_1.isConditionalExpression)(expression)) {
        return (0, get_skittles_expression_1.default)(expression, interfaces, constants);
    }
    if ((0, typescript_1.isCallExpression)(expression)) {
        return (0, get_skittles_expression_1.default)(expression, interfaces, constants);
    }
    throw new Error(`Unknown return expression type: ${expression.kind}`);
};
const getReturnStatement = (expression, returnType, interfaces, constants) => {
    return {
        statementType: skittles_statement_1.SkittlesStatementType.Return,
        type: returnType,
        value: getReturnValue(expression, returnType, interfaces, constants),
    };
};
const getAssignmentValue = (expression, interfaces, constants) => {
    if ((0, ast_helper_1.isEquals)(expression)) {
        return (0, get_skittles_expression_1.default)(expression.right, interfaces, constants);
    }
    if ((0, ast_helper_1.isPlusEquals)(expression)) {
        return {
            expressionType: skittles_expression_1.SkittlesExpressionType.Binary,
            operator: skittles_expression_1.SkittlesOperator.Plus,
            left: (0, get_skittles_expression_1.default)(expression.left, interfaces, constants),
            right: (0, get_skittles_expression_1.default)(expression.right, interfaces, constants),
        };
    }
    if ((0, ast_helper_1.isMinusEquals)(expression)) {
        return {
            expressionType: skittles_expression_1.SkittlesExpressionType.Binary,
            operator: skittles_expression_1.SkittlesOperator.Minus,
            left: (0, get_skittles_expression_1.default)(expression.left, interfaces, constants),
            right: (0, get_skittles_expression_1.default)(expression.right, interfaces, constants),
        };
    }
    throw new Error(`Unknown binary expression: ${expression.operatorToken.kind}`);
};
const getExpressionStatement = (statement, interfaces, constants, events) => {
    const { expression } = statement;
    if ((0, typescript_1.isBinaryExpression)(expression)) {
        if ((0, typescript_1.isPropertyAccessExpression)(expression.left)) {
            return {
                statementType: skittles_statement_1.SkittlesStatementType.StorageUpdate,
                variable: (0, ast_helper_1.getNodeName)(expression.left),
                value: getAssignmentValue(expression, interfaces, constants),
            };
        }
        if ((0, typescript_1.isElementAccessExpression)(expression.left)) {
            let currentExpression = [...[expression.left]][0];
            const items = [];
            while ((0, typescript_1.isElementAccessExpression)(currentExpression)) {
                items.unshift((0, get_skittles_expression_1.default)(currentExpression.argumentExpression, interfaces, constants));
                currentExpression = currentExpression.expression;
            }
            return {
                statementType: skittles_statement_1.SkittlesStatementType.MappingUpdate,
                variable: (0, ast_helper_1.getNodeName)(currentExpression),
                items,
                value: getAssignmentValue(expression, interfaces, constants),
            };
        }
        if ((0, typescript_1.isIdentifier)(expression.left)) {
            return {
                statementType: skittles_statement_1.SkittlesStatementType.VariableUpdate,
                variable: (0, ast_helper_1.getNodeName)(expression.left),
                value: getAssignmentValue(expression, interfaces, constants),
            };
        }
        throw new Error(`Unknown binary expression type: ${expression.kind}`);
    }
    if ((0, typescript_1.isCallExpression)(expression)) {
        const callExpression = expression.expression;
        if ((0, typescript_1.isPropertyAccessExpression)(callExpression)) {
            const target = (0, ast_helper_1.getNodeName)(callExpression);
            // Handle events
            if (target === "emit") {
                const eventName = (0, ast_helper_1.getNodeName)(callExpression.expression);
                const event = events.find((event) => event.label === eventName);
                if (!event)
                    throw new Error(`Could not find event ${eventName}`);
                const args = [];
                expression.arguments.forEach((argument) => {
                    if ((0, typescript_1.isObjectLiteralExpression)(argument)) {
                        argument.properties.forEach((property) => {
                            if ((0, typescript_1.isPropertyAssignment)(property)) {
                                args.push({
                                    name: (0, ast_helper_1.getNodeName)(property.name),
                                    value: (0, get_skittles_expression_1.default)(property.initializer, interfaces, constants),
                                });
                            }
                            else if ((0, typescript_1.isShorthandPropertyAssignment)(property)) {
                                args.push({
                                    name: (0, ast_helper_1.getNodeName)(property.name),
                                    value: (0, get_skittles_expression_1.default)(property.name, interfaces, constants),
                                });
                            }
                            else {
                                throw new Error(`Unknown argument property type: ${property.kind}`);
                            }
                        });
                        return {
                            type: skittles_statement_1.SkittlesStatementType.EmitEvent,
                            event,
                            args,
                        };
                    }
                    throw new Error(`Unknown argument type: ${argument.kind}`);
                });
                return {
                    statementType: skittles_statement_1.SkittlesStatementType.EmitEvent,
                    event,
                    values: event.parameters.map((parameter) => {
                        const arg = args.find((arg) => arg.name === parameter.name);
                        if (!arg)
                            throw new Error(`Could not find arg ${parameter.name}`);
                        return arg.value;
                    }),
                };
            }
        }
        if (callExpression.kind === typescript_1.SyntaxKind.SuperKeyword) {
            return {
                statementType: skittles_statement_1.SkittlesStatementType.Ignore,
            };
        }
        // Handle other calls
        return {
            statementType: skittles_statement_1.SkittlesStatementType.Expression,
            expression: (0, get_skittles_expression_1.default)(expression, interfaces, constants),
        };
    }
    throw new Error("Not implemented expression statement handling");
};
const getIfStatement = (statement, interfaces, constants, events) => {
    const { expression, thenStatement, elseStatement } = statement;
    if (!thenStatement)
        throw new Error("If statement has no then statement");
    return {
        statementType: skittles_statement_1.SkittlesStatementType.If,
        condition: (0, get_skittles_expression_1.default)(expression, interfaces, constants),
        then: getSkittlesStatements(thenStatement, {
            kind: skittles_type_1.SkittlesTypeKind.Void,
        }, interfaces, constants, events),
        else: getSkittlesStatements(elseStatement, {
            kind: skittles_type_1.SkittlesTypeKind.Void,
        }, interfaces, constants, events),
    };
};
const getThrowStatement = (statement, interfaces, constants) => {
    const { expression } = statement;
    if ((0, typescript_1.isNewExpression)(expression)) {
        const args = expression.arguments;
        if (!args)
            throw new Error("Throw statement has no arguments");
        if (args.length === 0)
            throw new Error("Throw statement has no arguments");
        if (args.length > 1)
            throw new Error("Throw statement has too many arguments");
        return {
            statementType: skittles_statement_1.SkittlesStatementType.Throw,
            error: (0, get_skittles_expression_1.default)(args[0], interfaces, constants),
        };
    }
    throw new Error("Not implemented throw statement handling");
};
const getVariableStatement = (statement, interfaces, constants) => {
    const { declarationList } = statement;
    const statements = [];
    declarationList.declarations.forEach((declaration) => {
        const { name, initializer } = declaration;
        if (!initializer)
            throw new Error("Variable statement has no initializer");
        // Handling normal variable assignments
        if ((0, typescript_1.isIdentifier)(name)) {
            statements.push({
                statementType: skittles_statement_1.SkittlesStatementType.VariableDeclaration,
                variable: (0, ast_helper_1.getNodeName)(name),
                value: (0, get_skittles_expression_1.default)(initializer, interfaces, constants),
            });
            return;
        }
        // handling array binding, e.g. `const [a, b] = [1, 2]`
        if ((0, typescript_1.isArrayBindingPattern)(name)) {
            if ((0, typescript_1.isArrayLiteralExpression)(initializer)) {
                name.elements.forEach((element, index) => {
                    if ((0, typescript_1.isBindingElement)(element)) {
                        statements.push({
                            statementType: skittles_statement_1.SkittlesStatementType.VariableDeclaration,
                            variable: (0, ast_helper_1.getNodeName)(element.name),
                            value: (0, get_skittles_expression_1.default)(initializer.elements[index], interfaces, constants),
                        });
                        return;
                    }
                    throw new Error("Unsupported array binding element");
                });
                return;
            }
            if ((0, typescript_1.isConditionalExpression)(initializer)) {
                name.elements.forEach((element, index) => {
                    const { whenTrue, whenFalse } = initializer;
                    if (!(0, typescript_1.isArrayLiteralExpression)(whenTrue)) {
                        throw new Error("Unsupported array binding element for whenTrue");
                    }
                    if (!(0, typescript_1.isArrayLiteralExpression)(whenFalse)) {
                        throw new Error("Unsupported array binding element for whenFalse");
                    }
                    if ((0, typescript_1.isBindingElement)(element)) {
                        statements.push({
                            statementType: skittles_statement_1.SkittlesStatementType.VariableDeclaration,
                            variable: (0, ast_helper_1.getNodeName)(element.name),
                            value: {
                                expressionType: skittles_expression_1.SkittlesExpressionType.Conditional,
                                condition: (0, get_skittles_expression_1.default)(initializer.condition, interfaces, constants),
                                trueValue: (0, get_skittles_expression_1.default)(whenTrue.elements[index], interfaces, constants),
                                falseValue: (0, get_skittles_expression_1.default)(whenFalse.elements[index], interfaces, constants),
                            },
                        });
                        return;
                    }
                    throw new Error("Unsupported array binding element");
                });
                return;
            }
            throw new Error("Unsupported array binding initializer");
        }
        throw new Error(`Not implemented variable statement handling ${name.kind}`);
    });
    return statements;
};
const getIdentifierStatement = (statement, returnType, interfaces, constants) => {
    return {
        statementType: skittles_statement_1.SkittlesStatementType.Return,
        type: returnType,
        value: (0, get_skittles_expression_1.default)(statement, interfaces, constants),
    };
};
const getConditionalExpressionStatement = (statement, returnType, interfaces, constants) => {
    return {
        statementType: skittles_statement_1.SkittlesStatementType.Return,
        type: returnType,
        value: (0, get_skittles_expression_1.default)(statement, interfaces, constants),
    };
};
const getBaseSkittlesStatement = (node, returnType, interfaces, constants, events) => {
    if ((0, typescript_1.isExpressionStatement)(node)) {
        return [getExpressionStatement(node, interfaces, constants, events)];
    }
    if ((0, typescript_1.isReturnStatement)(node)) {
        const { expression } = node;
        if (!expression)
            throw new Error("Return statement has no expression");
        return [getReturnStatement(expression, returnType, interfaces, constants)];
    }
    if ((0, typescript_1.isIfStatement)(node)) {
        return [getIfStatement(node, interfaces, constants, events)];
    }
    if ((0, typescript_1.isThrowStatement)(node)) {
        return [getThrowStatement(node, interfaces, constants)];
    }
    if ((0, ast_helper_1.isExpression)(node)) {
        return [getReturnStatement(node, returnType, interfaces, constants)];
    }
    if ((0, typescript_1.isVariableStatement)(node)) {
        return getVariableStatement(node, interfaces, constants);
    }
    if ((0, typescript_1.isIdentifier)(node)) {
        return [getIdentifierStatement(node, returnType, interfaces, constants)];
    }
    if ((0, typescript_1.isConditionalExpression)(node)) {
        return [getConditionalExpressionStatement(node, returnType, interfaces, constants)];
    }
    if ((0, typescript_1.isLiteralExpression)(node)) {
        return [getReturnStatement(node, returnType, interfaces, constants)];
    }
    if ((0, typescript_1.isParenthesizedExpression)(node)) {
        return [getReturnStatement(node.expression, returnType, interfaces, constants)];
    }
    throw new Error(`Unknown statement type: ${node.kind}`);
};
const getSkittlesStatement = (node, returnType, interfaces, constants, events) => {
    const base = getBaseSkittlesStatement(node, returnType, interfaces, constants, events);
    return (0, extract_conditional_expression_statements_1.default)(base);
};
exports.default = getSkittlesStatements;
