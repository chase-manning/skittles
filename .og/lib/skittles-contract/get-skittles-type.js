"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("ethers/lib/utils");
const typescript_1 = require("typescript");
const skittles_type_1 = require("../types/skittles-type");
const stringType = { kind: skittles_type_1.SkittlesTypeKind.String };
const addressType = { kind: skittles_type_1.SkittlesTypeKind.Address };
const uint256Type = { kind: skittles_type_1.SkittlesTypeKind.Number };
const boolType = { kind: skittles_type_1.SkittlesTypeKind.Boolean };
const voidType = { kind: skittles_type_1.SkittlesTypeKind.Void };
const bytesType = { kind: skittles_type_1.SkittlesTypeKind.Bytes };
const getSkittlesType = (type, interfaces, value) => {
    if (!type)
        return voidType;
    const { kind } = type;
    if (!kind)
        return voidType;
    switch (kind) {
        case typescript_1.SyntaxKind.StringKeyword:
            if (!value)
                return stringType;
            if ((0, utils_1.isAddress)(value))
                return addressType;
            return stringType;
        case typescript_1.SyntaxKind.StringLiteral:
            if (!value)
                return stringType;
            if ((0, utils_1.isAddress)(value))
                return addressType;
            return stringType;
        case typescript_1.SyntaxKind.NumberKeyword:
            return uint256Type;
        case typescript_1.SyntaxKind.NumericLiteral:
            return uint256Type;
        case typescript_1.SyntaxKind.BooleanKeyword:
            return boolType;
        case typescript_1.SyntaxKind.VoidKeyword:
            return voidType;
        case typescript_1.SyntaxKind.AnyKeyword:
            throw new Error("Any type not supported");
        case typescript_1.SyntaxKind.TypeReference:
            const { typeName } = type;
            if (!typeName)
                throw new Error("Could not get type name");
            const { escapedText } = typeName;
            if (!escapedText)
                throw new Error("Could not get type escaped text");
            switch (escapedText) {
                case "address":
                    return addressType;
                case "bytes":
                    return bytesType;
                case "Record":
                    let record = type;
                    const inputs = [];
                    while (record.kind === typescript_1.SyntaxKind.TypeReference &&
                        record.typeName &&
                        record.typeName.escapedText &&
                        record.typeName.escapedText === "Record") {
                        const { typeArguments } = record;
                        if (!typeArguments || typeArguments.length !== 2) {
                            throw new Error("Could not get type arguments");
                        }
                        const [input, output] = typeArguments;
                        inputs.push(getSkittlesType(input, interfaces));
                        record = output;
                    }
                    return {
                        kind: skittles_type_1.SkittlesTypeKind.Mapping,
                        inputs,
                        output: getSkittlesType(record, interfaces),
                    };
                default:
                    const face = interfaces[escapedText];
                    if (!face)
                        throw new Error(`Could not find interface ${escapedText}`);
                    return {
                        kind: skittles_type_1.SkittlesTypeKind.Interface,
                        interface: face,
                    };
            }
        case typescript_1.SyntaxKind.ArrayType:
            if (!(0, typescript_1.isArrayTypeNode)(type))
                throw new Error("Could not get array type");
            return {
                kind: skittles_type_1.SkittlesTypeKind.Array,
                itemType: getSkittlesType(type.elementType, interfaces),
            };
        default:
            throw new Error(`Unknown syntax kind: ${kind}`);
    }
};
exports.default = getSkittlesType;
