"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yul_template_1 = require("../data/yul-template");
const yul_helper_1 = require("../helpers/yul-helper");
const get_expression_yul_1 = __importDefault(require("./get-expression-yul"));
const addValueInitializations = (yul, property, index) => {
    if (!property.value || property.immutable)
        return yul;
    const expression = (0, get_expression_yul_1.default)(property.value);
    return (0, yul_helper_1.addToSection)(yul, yul_template_1.YulSection.Constructor, [`sstore(${index}, ${expression})`]);
};
exports.default = addValueInitializations;
