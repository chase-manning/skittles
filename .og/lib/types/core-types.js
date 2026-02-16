"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hash = exports.tx = exports.msg = exports.chain = exports.block = exports.self = void 0;
exports.self = "0x00000000006c3852cbEf3e08E8dF289169EdE581";
class block {
    // Current block miner’s address
    static get coinbase() {
        return "0x0000000000000000000000000000000000000000";
    }
    // Current block difficulty
    static get difficulty() {
        return 0;
    }
    // Current block number
    static get block() {
        return 0;
    }
    // Equivalent to blockhash(block.number - 1)
    static get prevhash() {
        return 0;
    }
    // Current block epoch timestamp
    static get timestamp() {
        return 0;
    }
}
exports.block = block;
class chain {
    // Chain ID
    static get id() {
        return 0;
    }
}
exports.chain = chain;
class msg {
    // Message data
    static get data() {
        return "";
    }
    // Sender of the message (current call)
    static get sender() {
        return "0x0000000000000000000000000000000000000000";
    }
    // Number of wei sent with the message
    static get value() {
        return 0;
    }
}
exports.msg = msg;
class tx {
    // Gas price of current transaction in wei
    static get gasPrice() {
        return 0;
    }
    // Sender of the transaction (full call chain)
    static get origin() {
        return "0x0000000000000000000000000000000000000000";
    }
}
exports.tx = tx;
const hash = (...args) => {
    return "123";
};
exports.hash = hash;
