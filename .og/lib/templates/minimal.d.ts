import { address } from "skittles/lib/types/core-types";
/**
 * A minimal Skittles contract example.
 * This demonstrates the basic structure of a Skittles smart contract.
 */
export declare class Minimal {
    value: number;
    readonly owner: address;
    /**
     * Sets the value
     */
    setValue(newValue: number): void;
    /**
     * Gets the current value
     */
    getValue(): number;
}
