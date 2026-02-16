"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const skittles_type_1 = require("../types/skittles-type");
const getTypeString = (type) => {
    return type.kind;
};
const getConstructorAbi = (constructor) => {
    if (!constructor)
        return [];
    constructor.parameters = constructor.parameters || [];
    return [
        {
            type: "constructor",
            inputs: constructor.parameters.map((i) => {
                return {
                    name: i.name,
                    type: getTypeString(i.type),
                };
            }),
            stateMutability: "nonpayable",
        },
    ];
};
const getPropertyAbi = (property) => {
    if (property.type.kind === skittles_type_1.SkittlesTypeKind.Mapping) {
        return {
            type: "function",
            name: property.name,
            inputs: property.type.inputs.map((i) => {
                return {
                    name: "",
                    type: getTypeString(i),
                };
            }),
            outputs: [{ name: "", type: getTypeString(property.type.output) }],
            stateMutability: "view",
        };
    }
    if (property.type.kind === skittles_type_1.SkittlesTypeKind.Array) {
        return {
            type: "function",
            name: property.name,
            inputs: [
                {
                    name: "index",
                    type: "uint256",
                },
            ],
            outputs: [{ name: "", type: getTypeString(property.type.itemType) }],
            stateMutability: "view",
        };
    }
    return {
        type: "function",
        name: property.name,
        inputs: [],
        outputs: [{ name: "", type: getTypeString(property.type) }],
        stateMutability: "view",
    };
};
const getMethodAbi = (method) => {
    const outputs = () => {
        const { returns } = method;
        if (returns.kind === skittles_type_1.SkittlesTypeKind.Void)
            return [];
        if (returns.kind === skittles_type_1.SkittlesTypeKind.Interface) {
            return [
                ...returns.interface.elements.map((e) => {
                    return {
                        name: e.name,
                        type: getTypeString(e.type),
                    };
                }),
            ];
        }
        return [
            {
                name: "",
                type: getTypeString(returns),
            },
        ];
    };
    return {
        type: "function",
        name: method.name,
        inputs: method.parameters.map((i) => {
            return {
                name: i.name,
                type: getTypeString(i.type),
            };
        }),
        outputs: outputs(),
        stateMutability: method.view ? "view" : "payable",
    };
};
const getEventAbi = (event) => {
    return {
        anonymous: false,
        inputs: event.parameters.map((i) => {
            return {
                indexed: false,
                name: i.name,
                type: getTypeString(i.type),
            };
        }),
        name: event.label,
        type: "event",
    };
};
const getAbi = (contract) => {
    return [
        ...contract.events.map(getEventAbi),
        ...getConstructorAbi(contract.constructor),
        ...contract.variables.filter((p) => !p.private).map(getPropertyAbi),
        ...contract.methods.filter((p) => !p.private).map(getMethodAbi),
    ];
};
exports.default = getAbi;
