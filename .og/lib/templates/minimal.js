"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Minimal = void 0;
const core_types_1 = require("skittles/lib/types/core-types");
/**
 * A minimal Skittles contract example.
 * This demonstrates the basic structure of a Skittles smart contract.
 */
class Minimal {
    constructor() {
        // Public state variable
        this.value = 0;
        // Read-only state variable
        this.owner = core_types_1.msg.sender;
    }
    /**
     * Sets the value
     */
    setValue(newValue) {
        this.value = newValue;
    }
    /**
     * Gets the current value
     */
    getValue() {
        return this.value;
    }
}
exports.Minimal = Minimal;
