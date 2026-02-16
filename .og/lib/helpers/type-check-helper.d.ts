/**
 * Performs TypeScript type checking on all contract files.
 * @param config - The Skittles configuration object
 * @throws Error if type checking is enabled and errors are found
 */
export declare const typeCheckContracts: (config: {
    typeCheck?: boolean;
}) => void;
