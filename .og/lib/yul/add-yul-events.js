"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yul_template_1 = require("../data/yul-template");
const selector_helper_1 = require("../helpers/selector-helper");
const yul_helper_1 = require("../helpers/yul-helper");
const addEvents = (yul, events) => {
    const yuls = events.map((event) => {
        const { label, parameters } = event;
        return [
            `function emit${label}Event(${parameters.map((p) => `${p.name}Var`).join(", ")}) {`,
            ...parameters.map((p, index) => `mstore(${index * 32}, ${p.name}Var)`),
            `log1(0, ${32 * parameters.length}, ${(0, selector_helper_1.getEventSelector)(event)})`,
            `}`,
        ];
    });
    return (0, yul_helper_1.addToSection)((0, yul_helper_1.addToSection)(yul, yul_template_1.YulSection.ConstructorEvents, yuls.flat()), yul_template_1.YulSection.Events, yuls.flat());
};
exports.default = addEvents;
