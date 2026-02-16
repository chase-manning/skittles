"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const format_yul_1 = __importDefault(require("./format-yul"));
const yul_helper_1 = require("../helpers/yul-helper");
const add_yul_storage_layout_1 = __importDefault(require("./add-yul-storage-layout"));
const add_yul_constructor_1 = __importDefault(require("./add-yul-constructor"));
const add_yul_property_dispatcher_1 = __importDefault(require("./add-yul-property-dispatcher"));
const add_yul_method_dispatcher_1 = __importDefault(require("./add-yul-method-dispatcher"));
const add_yul_method_function_1 = __importDefault(require("./add-yul-method-function"));
const add_yul_storage_access_1 = __importDefault(require("./add-yul-storage-access"));
const add_yul_value_initialzations_1 = __importDefault(require("./add-yul-value-initialzations"));
const add_yul_events_1 = __importDefault(require("./add-yul-events"));
const getYul = (contract, abi) => {
    // Getting base data
    let yul = (0, yul_helper_1.getBaseYul)(contract.name);
    // Adding properties
    let slot = 0;
    contract.variables.forEach((property) => {
        yul = (0, add_yul_property_dispatcher_1.default)(yul, abi, property);
        let r = (0, add_yul_storage_layout_1.default)(yul, property, contract, slot);
        yul = (0, add_yul_storage_access_1.default)(r.yul, property, contract);
        yul = (0, add_yul_value_initialzations_1.default)(yul, property, slot);
        slot = r.slot;
    });
    // Adding constructor
    yul = (0, add_yul_constructor_1.default)(yul, contract);
    // Adding methods
    contract.methods.forEach((method) => {
        yul = (0, add_yul_method_dispatcher_1.default)(yul, abi, method);
        yul = (0, add_yul_method_function_1.default)(yul, method);
    });
    // Adding functions
    contract.functions.forEach((method) => {
        yul = (0, add_yul_method_function_1.default)(yul, method, true);
    });
    // Adding events
    yul = (0, add_yul_events_1.default)(yul, contract.events);
    // Formatting
    return (0, format_yul_1.default)(yul);
};
exports.default = getYul;
