"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_1 = require("typescript");
const ast_helper_1 = require("../helpers/ast-helper");
const get_skittles_type_1 = __importDefault(require("./get-skittles-type"));
const getElements = (node) => {
    const { members } = node;
    if (!members)
        return [];
    const properties = [];
    members.forEach((member) => {
        if (!(0, typescript_1.isPropertySignature)(member))
            return;
        const { name, type } = member;
        if (!name || !type)
            return;
        properties.push({
            name: (0, ast_helper_1.getNodeName)(name),
            type: (0, get_skittles_type_1.default)(type, {}),
        });
    });
    return properties;
};
const getInterfaces = (node) => {
    const interfaces = [];
    (0, typescript_1.forEachChild)(node, (child) => {
        if ((0, typescript_1.isInterfaceDeclaration)(child)) {
            interfaces.push({
                name: (0, ast_helper_1.getNodeName)(child),
                elements: getElements(child),
            });
        }
        else
            interfaces.push(...getInterfaces(child));
    });
    return interfaces;
};
const getSkittlesInterfaces = (node) => {
    const interfaces = getInterfaces(node);
    const skittlesInterfaces = {};
    interfaces.forEach((i) => (skittlesInterfaces[i.name] = i));
    return skittlesInterfaces;
};
exports.default = getSkittlesInterfaces;
