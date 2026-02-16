"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDependencies = exports.isExpression = exports.isVariable = exports.isPropertyArrowFunction = exports.isNodeImmutable = exports.isNodePrivate = exports.isFalseKeyword = exports.isTrueKeyword = exports.isMinusEquals = exports.isEquals = exports.isPlusEquals = exports.getNodeName = exports.getClassNodes = void 0;
const typescript_1 = require("typescript");
const file_helper_1 = require("./file-helper");
const getClassNodes = (node) => {
    if ((0, typescript_1.isClassDeclaration)(node))
        return [node];
    let classNodes = [];
    (0, typescript_1.forEachChild)(node, (child) => {
        if ((0, typescript_1.isClassDeclaration)(child)) {
            classNodes.push(child);
        }
    });
    return classNodes;
};
exports.getClassNodes = getClassNodes;
const getNodeName = (node) => {
    if (node.text)
        return node.text;
    if (node.escapedText)
        return node.escapedText;
    return node.name.escapedText;
};
exports.getNodeName = getNodeName;
const isPlusEquals = (expression) => {
    return expression.operatorToken.kind === typescript_1.SyntaxKind.PlusEqualsToken;
};
exports.isPlusEquals = isPlusEquals;
const isEquals = (expression) => {
    return expression.operatorToken.kind === typescript_1.SyntaxKind.EqualsToken;
};
exports.isEquals = isEquals;
const isMinusEquals = (expression) => {
    return expression.operatorToken.kind === typescript_1.SyntaxKind.MinusEqualsToken;
};
exports.isMinusEquals = isMinusEquals;
const isTrueKeyword = (node) => {
    return node.kind === typescript_1.SyntaxKind.TrueKeyword;
};
exports.isTrueKeyword = isTrueKeyword;
const isFalseKeyword = (node) => {
    return node.kind === typescript_1.SyntaxKind.FalseKeyword;
};
exports.isFalseKeyword = isFalseKeyword;
const isNodePrivate = (node) => {
    let isPrivate = false;
    (0, typescript_1.forEachChild)(node, (node) => {
        if (node.kind === typescript_1.SyntaxKind.PrivateKeyword || node.kind === typescript_1.SyntaxKind.ProtectedKeyword) {
            isPrivate = true;
        }
    });
    return isPrivate;
};
exports.isNodePrivate = isNodePrivate;
const isNodeImmutable = (node) => {
    let isImmutable = false;
    (0, typescript_1.forEachChild)(node, (node) => {
        if (node.kind === typescript_1.SyntaxKind.ReadonlyKeyword) {
            isImmutable = true;
        }
    });
    return isImmutable;
};
exports.isNodeImmutable = isNodeImmutable;
const isPropertyArrowFunction = (node) => {
    if (!(0, typescript_1.isPropertyDeclaration)(node))
        return false;
    if (!node.initializer)
        return false;
    return (0, typescript_1.isArrowFunction)(node.initializer);
};
exports.isPropertyArrowFunction = isPropertyArrowFunction;
const isVariable = (property) => {
    return !(0, exports.isPropertyArrowFunction)(property);
};
exports.isVariable = isVariable;
const isExpression = (node) => {
    return ((0, typescript_1.isBinaryExpression)(node) ||
        (0, exports.isTrueKeyword)(node) ||
        (0, exports.isFalseKeyword)(node) ||
        (0, typescript_1.isPropertyAccessExpression)(node) ||
        (0, typescript_1.isElementAccessExpression)(node) ||
        (0, typescript_1.isPrefixUnaryExpression)(node));
};
exports.isExpression = isExpression;
const getDependencies = (ast, sourceFile) => {
    let dependencies = [];
    (0, typescript_1.forEachChild)(ast, (child) => {
        if (!(0, typescript_1.isImportDeclaration)(child))
            return;
        const module = (0, exports.getNodeName)(child.moduleSpecifier);
        if (module === "skittles")
            return;
        const absolutePath = (0, file_helper_1.relativePathToAbsolute)(module, sourceFile);
        if (absolutePath.includes("core-types.ts"))
            return; // TODO Remove this
        dependencies.push(absolutePath);
    });
    return dependencies;
};
exports.getDependencies = getDependencies;
