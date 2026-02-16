"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const solc = require("solc");
const getBytecode = (className, content, config) => {
    const input = {
        language: "Yul",
        sources: {
            main: {
                content,
            },
        },
        settings: {
            optimizer: config.optimizer,
            outputSelection: {
                "*": {
                    "*": ["*"],
                },
            },
        },
    };
    let compiled;
    try {
        const compiledOutput = solc.compile(JSON.stringify(input));
        compiled = JSON.parse(compiledOutput);
    }
    catch (error) {
        throw new Error(`Failed to compile contract "${className}": ${(error === null || error === void 0 ? void 0 : error.message) || "Unknown compilation error"}`);
    }
    // Check for compilation errors
    if (compiled.errors && Array.isArray(compiled.errors) && compiled.errors.length > 0) {
        const errors = compiled.errors.filter((e) => e.severity === "error");
        if (errors.length > 0) {
            const errorMessages = errors
                .map((error) => {
                const severity = error.severity || "error";
                const message = error.message || "Unknown error";
                const formattedMessage = error.formattedMessage || message;
                return `[${severity.toUpperCase()}] ${formattedMessage}`;
            })
                .join("\n");
            throw new Error(`Solc compilation failed for contract "${className}":\n${errorMessages}`);
        }
    }
    // Check if contracts object exists
    if (!compiled.contracts || !compiled.contracts["main"]) {
        throw new Error(`No contracts found in compilation output for contract "${className}"`);
    }
    // Check if the specific contract exists
    if (!compiled.contracts["main"][className]) {
        throw new Error(`Contract "${className}" not found in compilation output`);
    }
    // Check if bytecode exists
    const contract = compiled.contracts["main"][className];
    if (!contract.evm || !contract.evm.bytecode || !contract.evm.bytecode.object) {
        throw new Error(`No bytecode generated for contract "${className}"`);
    }
    return contract.evm.bytecode.object;
};
exports.default = getBytecode;
