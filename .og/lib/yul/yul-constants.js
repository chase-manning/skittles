"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evmDialects = exports.returnFunctions = exports.decoderFunctions = void 0;
exports.decoderFunctions = {
    address: "decodeAsAddress",
    uint256: "decodeAsUint",
    bool: "decodeAsUint",
    bytes32: "decodeAsUint",
};
exports.returnFunctions = {
    uint256: "return256",
    bool: "returnBoolean",
    address: "return256",
    string: "returnString",
    array: "returnArray",
    bytes32: "return256",
};
exports.evmDialects = {
    block: {
        coinbase: "coinbase()",
        difficulty: "difficulty()",
        block: "number()",
        prevhash: "",
        timestamp: "timestamp()",
    },
    chain: {
        id: "chainid()",
    },
    msg: {
        data: "",
        sender: "caller()",
        value: "callvalue()",
    },
    tx: {
        gasPrice: "gasprice()",
        origin: "origin()",
    },
};
