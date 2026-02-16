"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBaseYul = exports.addToSection = void 0;
const yul_template_1 = __importDefault(require("../data/yul-template"));
const addToSection = (yul, section, lines) => {
    const sectionIndex = yul.findIndex((line) => line.includes(`- ${section} -`));
    if (sectionIndex === -1)
        return yul;
    yul.splice(sectionIndex + 1, 0, ...lines);
    return yul;
};
exports.addToSection = addToSection;
const getBaseYul = (name) => {
    const base = [...yul_template_1.default];
    base.unshift(`object "${name}" {`);
    return base;
};
exports.getBaseYul = getBaseYul;
