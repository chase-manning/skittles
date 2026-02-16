"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEvent = void 0;
const typescript_1 = require("typescript");
const ast_helper_1 = require("../helpers/ast-helper");
const isEvent = (type) => {
    const { kind } = type;
    if (!kind)
        return false;
    if (kind !== typescript_1.SyntaxKind.TypeReference)
        return false;
    return type.typeName.escapedText === "SkittlesEvent";
};
exports.isEvent = isEvent;
const getSkittlesEvents = (astProperties, interfaces) => {
    const events = [];
    for (const astProperty of astProperties) {
        const { type } = astProperty;
        if (!type)
            continue;
        if (!(0, exports.isEvent)(type))
            continue;
        const { typeArguments } = type;
        if (!typeArguments || typeArguments.length !== 1) {
            throw new Error("Could not get type arguments");
        }
        const parametersInterface = typeArguments[0];
        if (parametersInterface.kind !== typescript_1.SyntaxKind.TypeReference) {
            throw new Error("Could type arguments not interface");
        }
        const interfaceName = parametersInterface.typeName.escapedText;
        const params = interfaces[interfaceName];
        if (!params)
            throw new Error(`Could not find interface: ${interfaceName}`);
        events.push({
            label: (0, ast_helper_1.getNodeName)(astProperty.name),
            parameters: params.elements,
        });
    }
    return events;
};
exports.default = getSkittlesEvents;
