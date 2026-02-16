"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventSelector = exports.getFunctionSelector = void 0;
const ethers_1 = require("ethers");
const exampleValues = {
    uint256: 1,
    bool: true,
    string: "hello",
    address: "0x1234567890123456789012345678901234567890",
    bytes32: "0x1234567890123456789012345678901234567890123456789012345678901234",
};
const getFunctionSelector = (abi, func) => {
    const iface = new ethers_1.utils.Interface(abi);
    const abiFunction = abi.find((f) => f.name === func);
    if (!abiFunction)
        throw new Error(`Could not find function ${func}`);
    const params = abiFunction.inputs.map((input) => {
        const exampleValue = exampleValues[input.type];
        if (!exampleValue)
            throw new Error(`Could not find example value for ${input.type}`);
        return exampleValue;
    });
    const data = iface.encodeFunctionData(func, params);
    return data.substring(0, 10);
};
exports.getFunctionSelector = getFunctionSelector;
const getEventSelector = (event) => {
    const eventString = `event ${event.label}(${event.parameters
        .map((p) => `${p.type.kind} ${p.name}`)
        .join(", ")})`;
    const iface = new ethers_1.utils.Interface([eventString]);
    const sigHash = iface.events[Object.keys(iface.events)[0]].format("sighash");
    return ethers_1.utils.keccak256(ethers_1.utils.toUtf8Bytes(sigHash));
};
exports.getEventSelector = getEventSelector;
