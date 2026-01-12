import ts from "typescript";
import path from "path";
import fs from "fs";
import { getAllTypescriptFiles } from "./file-helper";

/**
 * Creates a TypeScript compiler options object suitable for contract files.
 * Uses the project's tsconfig.json if found, merging with contract-specific defaults.
 * When using createProgram with explicit file paths, rootDir/include/exclude are ignored,
 * so we can safely use the project's config while overriding problematic settings.
 */
const getCompilerOptions = (projectRoot: string): ts.CompilerOptions => {
  // Use TypeScript's built-in function to find tsconfig.json
  const tsConfigPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, "tsconfig.json");

  const defaults = getDefaultCompilerOptions();

  if (!tsConfigPath) {
    return defaults;
  }

  // Read and parse the config file
  const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  if (configFile.error) {
    return defaults;
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsConfigPath),
    undefined,
    tsConfigPath
  );

  // Filter out non-critical errors (warnings don't prevent us from using the config)
  const criticalErrors = parsedConfig.errors?.filter(
    (e) => e.category === ts.DiagnosticCategory.Error
  );
  if (criticalErrors && criticalErrors.length > 0) {
    return defaults;
  }

  // Merge project config with defaults, overriding settings that conflict with contract checking
  return {
    ...defaults,
    ...parsedConfig.options,
    // Override problematic settings - these don't matter when passing files directly to createProgram
    rootDir: undefined, // Allow contracts outside src/
    // Keep useful settings from project config (paths, moduleResolution, etc.)
    // but ensure contract-specific overrides
    strictPropertyInitialization: false, // Contracts initialize properties at runtime
    noEmit: true, // We're only type checking, not emitting
  };
};

/**
 * Returns default TypeScript compiler options for contract files.
 * These options are similar to the project's tsconfig.json but optimized for contract checking.
 */
const getDefaultCompilerOptions = (): ts.CompilerOptions => {
  const projectRoot = process.cwd();
  const nodeModulesPath = path.join(projectRoot, "node_modules");
  const typesPath = path.join(nodeModulesPath, "@types");

  return {
    target: ts.ScriptTarget.ES2019,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    strict: true,
    skipLibCheck: true,
    // Allow importing from node_modules (for skittles types)
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    // Resolve paths relative to project root
    baseUrl: projectRoot,
    // Include type definitions from node_modules
    typeRoots: fs.existsSync(typesPath) ? [typesPath] : undefined,
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
export const typeCheckContracts = (config: { typeCheck?: boolean }): void => {
  // Skip type checking if disabled
  if (config.typeCheck === false) {
    return;
  }

  const contractsPath = path.join(process.cwd(), "contracts");

  // Check if contracts directory exists
  if (!fs.existsSync(contractsPath)) {
    // No contracts directory, nothing to check
    return;
  }

  const contractFiles = getAllTypescriptFiles();

  // If no contract files found, nothing to check
  if (contractFiles.length === 0) {
    return;
  }

  // Get compiler options
  const compilerOptions = getCompilerOptions(process.cwd());

  // Create a custom compiler host that can resolve modules correctly
  const host = ts.createCompilerHost(compilerOptions);

  // Override the resolveModuleNames to handle both relative and package imports
  const originalResolveModuleNames = host.resolveModuleNames;
  host.resolveModuleNames = (
    moduleNames: string[],
    containingFile: string,
    reusedNames: string[] | undefined,
    redirectedReference: ts.ResolvedProjectReference | undefined,
    options: ts.CompilerOptions,
    containingSourceFile?: ts.SourceFile
  ): (ts.ResolvedModule | undefined)[] => {
    // First try the original resolver for all modules
    let resolved: (ts.ResolvedModule | undefined)[] = [];
    if (originalResolveModuleNames) {
      resolved = originalResolveModuleNames(
        moduleNames,
        containingFile,
        reusedNames,
        redirectedReference,
        options,
        containingSourceFile
      );
    } else {
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
        const containingDir = path.dirname(containingFile);
        const resolvedPath = path.resolve(containingDir, moduleName);

        // Try with .ts, .d.ts, .js extensions
        for (const ext of [".ts", ".d.ts", ".js", ""]) {
          const testPath = resolvedPath + ext;
          if (fs.existsSync(testPath)) {
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
        const nodeModulesPath = path.join(projectRoot, "node_modules");
        const moduleBaseName = moduleName.split("/")[0]; // "skittles" from "skittles/lib/types/core-types"
        const modulePath = path.join(nodeModulesPath, moduleBaseName);
        if (fs.existsSync(modulePath)) {
          // Try to find the main entry point or the specific file
          let resolvedPath: string | undefined;

          if (moduleName.startsWith("skittles/")) {
            // For "skittles/lib/types/core-types", resolve to node_modules/skittles/lib/types/core-types
            const subPath = moduleName.substring("skittles/".length);
            const fullPath = path.join(modulePath, subPath);
            // Try with .ts, .d.ts, .js extensions
            for (const ext of [".ts", ".d.ts", ".js", ""]) {
              const testPath = fullPath + ext;
              if (fs.existsSync(testPath)) {
                resolvedPath = testPath;
                break;
              }
            }
          } else {
            // For "skittles", try to find package.json and use main/types
            const packageJsonPath = path.join(modulePath, "package.json");
            if (fs.existsSync(packageJsonPath)) {
              try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
                const mainPath = packageJson.types || packageJson.main || "index.js";
                const resolved = path.isAbsolute(mainPath)
                  ? mainPath
                  : path.join(modulePath, mainPath);
                if (fs.existsSync(resolved)) {
                  resolvedPath = resolved;
                }
              } catch {
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
  const collectDependencies = (filePath: string, visited: Set<string>): void => {
    if (visited.has(filePath)) return;
    visited.add(filePath);

    try {
      const content = fs.readFileSync(filePath, "utf8");
      const ast = ts.createSourceFile(
        filePath,
        content,
        compilerOptions.target || ts.ScriptTarget.ES2019
      );
      ts.forEachChild(ast, (node) => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const moduleName = node.moduleSpecifier.text;
          // Only collect relative imports (skip node_modules packages)
          if (moduleName.startsWith(".")) {
            const containingDir = path.dirname(filePath);
            const resolvedPath = path.resolve(containingDir, moduleName);
            // Try with .ts, .d.ts, .js extensions
            for (const ext of [".ts", ".d.ts", ".js", ""]) {
              const testPath = resolvedPath + ext;
              if (fs.existsSync(testPath) && !testPath.includes("node_modules")) {
                collectDependencies(testPath, visited);
                break;
              }
            }
          }
        }
      });
    } catch {
      // Ignore errors reading individual files
    }
  };

  const allFilesSet = new Set<string>(contractFiles);
  contractFiles.forEach((contractFile) => {
    collectDependencies(contractFile, allFilesSet);
  });

  // Create a program with contract files and all their dependencies
  const program = ts.createProgram(Array.from(allFilesSet), compilerOptions, host);

  // Get all diagnostics (errors and warnings)
  // getPreEmitDiagnostics already includes semantic, syntactic, and declaration diagnostics
  const diagnostics = ts.getPreEmitDiagnostics(program);

  // Filter to only show errors (not warnings) and only for contract files
  const errors = diagnostics.filter((diagnostic) => {
    // Only show errors, not warnings
    if (diagnostic.category !== ts.DiagnosticCategory.Error) {
      return false;
    }

    // Only show errors for contract files
    if (diagnostic.file) {
      const filePath = diagnostic.file.fileName;
      return contractFiles.some((contractFile) => {
        const normalizedContract = path.normalize(contractFile);
        const normalizedError = path.normalize(filePath);
        return normalizedContract === normalizedError;
      });
    }

    return true;
  });

  // If there are errors, format and throw
  if (errors.length > 0) {
    const formattedErrors = ts.formatDiagnosticsWithColorAndContext(errors, {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: (fileName) => fileName,
      getNewLine: () => "\n",
    });

    throw new Error(`TypeScript type checking failed:\n\n${formattedErrors}`);
  }
};
