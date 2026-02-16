"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const get_statement_yul_1 = __importDefault(require("./get-statement-yul"));
const getBlockYul = (statements) => {
    const yul = [];
    for (const statement of statements) {
        yul.push(...(0, get_statement_yul_1.default)(statement));
    }
    return yul;
};
exports.default = getBlockYul;
