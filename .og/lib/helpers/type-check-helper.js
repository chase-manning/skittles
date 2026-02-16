"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.typeCheckContracts = void 0;
const typescript_1 = __importDefault(require("typescript"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const file_helper_1 = require("./file-helper");
/**
 * Creates a TypeScript compiler options object suitable for contract files.
 * Uses the project's tsconfig.json if found, merging with contract-specific defaults.
 * When using createProgram with explicit file paths, rootDir/include/exclude are ignored,
 * so we can safely use the project's config while overriding problematic settings.
 */
const getCompilerOptions = (projectRoot) => {
    var _a;
    // Use TypeScript's built-in function to find tsconfig.json
    const tsConfigPath = typescript_1.default.findConfigFile(projectRoot, typescript_1.default.sys.fileExists, "tsconfig.json");
    const defaults = getDefaultCompilerOptions();
    if (!tsConfigPath) {
        return defaults;
    }
    // Read and parse the config file
    const configFile = typescript_1.default.readConfigFile(tsConfigPath, typescript_1.default.sys.readFile);
    if (configFile.error) {
        return defaults;
    }
    const parsedConfig = typescript_1.default.parseJsonConfigFileContent(configFile.config, typescript_1.default.sys, path_1.default.dirname(tsConfigPath), undefined, tsConfigPath);
    // Filter out non-critical errors (warnings don't prevent us from using the config)
    const criticalErrors = (_a = parsedConfig.errors) === null || _a === void 0 ? void 0 : _a.filter((e) => e.category === typescript_1.default.DiagnosticCategory.Error);
    if (criticalErrors && criticalErrors.length > 0) {
        return defaults;
    }
    // Merge project config with defaults, overriding settings that conflict with contract checking
    return {
        ...defaults,
        ...parsedConfig.options,
        // Override problematic settings - these don't matter when passing files directly to createProgram
        rootDir: undefined,
        // Keep useful settings from project config (paths, moduleResolution, etc.)
        // but ensure contract-specific overrides
        strictPropertyInitialization: false,
        noEmit: true, // We're only type checking, not emitting
    };
};
/**
 * Returns default TypeScript compiler options for contract files.
 * These options are similar to the project's tsconfig.json but optimized for contract checking.
 */
const getDefaultCompilerOptions = () => {
    const projectRoot = process.cwd();
    const nodeModulesPath = path_1.default.join(projectRoot, "node_modules");
    const typesPath = path_1.default.join(nodeModulesPath, "@types");
    return {
        target: typescript_1.default.ScriptTarget.ES2019,
        module: typescript_1.default.ModuleKind.CommonJS,
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        strict: true,
        skipLibCheck: true,
        // Allow importing from node_modules (for skittles types)
        moduleResolution: typescript_1.default.ModuleResolutionKind.NodeJs,
        // Resolve paths relative to project root
        baseUrl: projectRoot,
        // Include type definitions from node_modules
        typeRoots: fs_1.default.existsSync(typesPath) ? [typesPath] : undefined,
        // Allow JavaScript files to be imported (for compatibility)
        allowJs: false,
        // Don't emit files, just check types
        noEmit: true,
        // Don't restrict files to rootDir - contracts can be anywhere
        rootDir: undefined,
        // Relax strict property initialization for contracts (properties initialized at runtime in EVM)
        strictPropertyInitialization: false,
    };
};
/**
 * Performs TypeScript type checking on all contract files.
 * @param config - The Skittles configuration object
 * @throws Error if type checking is enabled and errors are found
 */
const typeCheckContracts = (config) => {
    // Skip type checking if disabled
    if (config.typeCheck === false) {
        return;
    }
    const contractsPath = path_1.default.join(process.cwd(), "contracts");
    // Check if contracts directory exists
    if (!fs_1.default.existsSync(contractsPath)) {
        // No contracts directory, nothing to check
        return;
    }
    const contractFiles = (0, file_helper_1.getAllTypescriptFiles)();
    // If no contract files found, nothing to check
    if (contractFiles.length === 0) {
        return;
    }
    // Get compiler options
    const compilerOptions = getCompilerOptions(process.cwd());
    // Create a custom compiler host that can resolve modules correctly
    const host = typescript_1.default.createCompilerHost(compilerOptions);
    // Override the resolveModuleNames to handle both relative and package imports
    const originalResolveModuleNames = host.resolveModuleNames;
    host.resolveModuleNames = (moduleNames, containingFile, reusedNames, redirectedReference, options, containingSourceFile) => {
        // First try the original resolver for all modules
        let resolved = [];
        if (originalResolveModuleNames) {
            resolved = originalResolveModuleNames(moduleNames, containingFile, reusedNames, redirectedReference, options, containingSourceFile);
        }
        else {
            resolved = moduleNames.map(() => undefined);
        }
        // For any unresolved modules, try to resolve them manually
        return moduleNames.map((moduleName, index) => {
            // If already resolved by the original resolver, return it
            if (resolved[index]) {
                return resolved[index];
            }
            // Handle relative imports (e.g., "../../src/types/core-types")
            if (moduleName.startsWith(".")) {
                const projectRoot = process.cwd();
                const containingDir = path_1.default.dirname(containingFile);
                const resolvedPath = path_1.default.resolve(containingDir, moduleName);
                // Try with .ts, .d.ts, .js extensions
                for (const ext of [".ts", ".d.ts", ".js", ""]) {
                    const testPath = resolvedPath + ext;
                    if (fs_1.default.existsSync(testPath)) {
                        return {
                            resolvedFileName: testPath,
                            isExternalLibraryImport: false,
                        };
                    }
                }
            }
            // If module name is "skittles" or starts with "skittles/", try to resolve from node_modules
            if (moduleName === "skittles" || moduleName.startsWith("skittles/")) {
                const projectRoot = process.cwd();
                const nodeModulesPath = path_1.default.join(projectRoot, "node_modules");
                const moduleBaseName = moduleName.split("/")[0]; // "skittles" from "skittles/lib/types/core-types"
                const modulePath = path_1.default.join(nodeModulesPath, moduleBaseName);
                if (fs_1.default.existsSync(modulePath)) {
                    // Try to find the main entry point or the specific file
                    let resolvedPath;
                    if (moduleName.startsWith("skittles/")) {
                        // For "skittles/lib/types/core-types", resolve to node_modules/skittles/lib/types/core-types
                        const subPath = moduleName.substring("skittles/".length);
                        const fullPath = path_1.default.join(modulePath, subPath);
                        // Try with .ts, .d.ts, .js extensions
                        for (const ext of [".ts", ".d.ts", ".js", ""]) {
                            const testPath = fullPath + ext;
                            if (fs_1.default.existsSync(testPath)) {
                                resolvedPath = testPath;
                                break;
                            }
                        }
                    }
                    else {
                        // For "skittles", try to find package.json and use main/types
                        const packageJsonPath = path_1.default.join(modulePath, "package.json");
                        if (fs_1.default.existsSync(packageJsonPath)) {
                            try {
                                const packageJson = JSON.parse(fs_1.default.readFileSync(packageJsonPath, "utf8"));
                                const mainPath = packageJson.types || packageJson.main || "index.js";
                                const resolved = path_1.default.isAbsolute(mainPath)
                                    ? mainPath
                                    : path_1.default.join(modulePath, mainPath);
                                if (fs_1.default.existsSync(resolved)) {
                                    resolvedPath = resolved;
                                }
                            }
                            catch {
                                // Ignore JSON parse errors
                            }
                        }
                    }
                    if (resolvedPath) {
                        return {
                            resolvedFileName: resolvedPath,
                            isExternalLibraryImport: true,
                        };
                    }
                }
            }
            return undefined;
        });
    };
    // Collect all dependency files that contracts import (recursively)
    // TypeScript needs these files to be accessible for type checking
    const collectDependencies = (filePath, visited) => {
        if (visited.has(filePath))
            return;
        visited.add(filePath);
        try {
            const content = fs_1.default.readFileSync(filePath, "utf8");
            const ast = typescript_1.default.createSourceFile(filePath, content, compilerOptions.target || typescript_1.default.ScriptTarget.ES2019);
            typescript_1.default.forEachChild(ast, (node) => {
                if (typescript_1.default.isImportDeclaration(node) && typescript_1.default.isStringLiteral(node.moduleSpecifier)) {
                    const moduleName = node.moduleSpecifier.text;
                    // Only collect relative imports (skip node_modules packages)
                    if (moduleName.startsWith(".")) {
                        const containingDir = path_1.default.dirname(filePath);
                        const resolvedPath = path_1.default.resolve(containingDir, moduleName);
                        // Try with .ts, .d.ts, .js extensions
                        for (const ext of [".ts", ".d.ts", ".js", ""]) {
                            const testPath = resolvedPath + ext;
                            if (fs_1.default.existsSync(testPath) && !testPath.includes("node_modules")) {
                                collectDependencies(testPath, visited);
                                break;
                            }
                        }
                    }
                }
            });
        }
        catch {
            // Ignore errors reading individual files
        }
    };
    const allFilesSet = new Set(contractFiles);
    contractFiles.forEach((contractFile) => {
        collectDependencies(contractFile, allFilesSet);
    });
    // Create a program with contract files and all their dependencies
    const program = typescript_1.default.createProgram(Array.from(allFilesSet), compilerOptions, host);
    // Get all diagnostics (errors and warnings)
    // getPreEmitDiagnostics already includes semantic, syntactic, and declaration diagnostics
    const diagnostics = typescript_1.default.getPreEmitDiagnostics(program);
    // Filter to only show errors (not warnings) and only for contract files
    const errors = diagnostics.filter((diagnostic) => {
        // Only show errors, not warnings
        if (diagnostic.category !== typescript_1.default.DiagnosticCategory.Error) {
            return false;
        }
        // Only show errors for contract files
        if (diagnostic.file) {
            const filePath = diagnostic.file.fileName;
            return contractFiles.some((contractFile) => {
                const normalizedContract = path_1.default.normalize(contractFile);
                const normalizedError = path_1.default.normalize(filePath);
                return normalizedContract === normalizedError;
            });
        }
        return true;
    });
    // If there are errors, format and throw
    if (errors.length > 0) {
        const formattedErrors = typescript_1.default.formatDiagnosticsWithColorAndContext(errors, {
            getCurrentDirectory: () => process.cwd(),
            getCanonicalFileName: (fileName) => fileName,
            getNewLine: () => "\n",
        });
        throw new Error(`TypeScript type checking failed:\n\n${formattedErrors}`);
    }
};
exports.typeCheckContracts = typeCheckContracts;
