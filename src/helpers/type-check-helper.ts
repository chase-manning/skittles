import ts from "typescript";
import path from "path";
import fs from "fs";
import { getAllTypescriptFiles } from "./file-helper";

/**
 * Finds a tsconfig.json file starting from the given directory and walking up the tree.
 * Returns the path to the tsconfig.json file, or null if not found.
 */
const findTsConfig = (startDir: string): string | null => {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const configPath = path.join(currentDir, "tsconfig.json");
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    currentDir = path.dirname(currentDir);
  }

  // Check root directory
  const rootConfigPath = path.join(root, "tsconfig.json");
  if (fs.existsSync(rootConfigPath)) {
    return rootConfigPath;
  }

  return null;
};

/**
 * Creates a TypeScript compiler options object suitable for contract files.
 * Uses the project's tsconfig.json if found, otherwise uses sensible defaults.
 */
const getCompilerOptions = (projectRoot: string): ts.CompilerOptions => {
  const tsConfigPath = findTsConfig(projectRoot);

  if (tsConfigPath) {
    const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
    if (configFile.error) {
      // If there's an error reading the config, use defaults
      return getDefaultCompilerOptions();
    }

    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(tsConfigPath)
    );

    if (parsedConfig.errors && parsedConfig.errors.length > 0) {
      // Filter out errors that are just warnings or don't affect type checking
      const criticalErrors = parsedConfig.errors.filter(
        (e) => e.category === ts.DiagnosticCategory.Error
      );
      if (criticalErrors.length > 0) {
        // If there are critical parsing errors, use defaults but log a warning
        console.warn(
          `Warning: Errors parsing tsconfig.json, using default compiler options. Errors: ${criticalErrors
            .map((e) => {
              const message =
                typeof e.messageText === "string" ? e.messageText : e.messageText.messageText;
              return message;
            })
            .join(", ")}`
        );
        return getDefaultCompilerOptions();
      }
    }

    // Merge with defaults to ensure important options are set
    const mergedOptions = {
      ...getDefaultCompilerOptions(),
      ...parsedConfig.options,
      // Ensure these are always set for contract checking
      skipLibCheck: parsedConfig.options.skipLibCheck ?? true,
      moduleResolution: parsedConfig.options.moduleResolution ?? ts.ModuleResolutionKind.NodeJs,
    };

    return mergedOptions;
  }

  return getDefaultCompilerOptions();
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
    // First try the original resolver
    if (originalResolveModuleNames) {
      const resolved = originalResolveModuleNames(
        moduleNames,
        containingFile,
        reusedNames,
        redirectedReference,
        options,
        containingSourceFile
      );
      // If all modules resolved, return early
      if (resolved.every((r) => r !== undefined)) {
        return resolved;
      }
    }

    // For any unresolved modules, try to resolve them manually
    return moduleNames.map((moduleName) => {
      // Try standard resolution first
      if (originalResolveModuleNames) {
        const standardResolved = originalResolveModuleNames(
          [moduleName],
          containingFile,
          reusedNames,
          redirectedReference,
          options,
          containingSourceFile
        );
        if (standardResolved[0]) {
          return standardResolved[0];
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
                const resolved = path.join(nodeModulesPath, mainPath);
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

  // Create a program with all contract files
  const program = ts.createProgram(contractFiles, compilerOptions, host);

  // Get all diagnostics (errors and warnings)
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(program.getSemanticDiagnostics())
    .concat(program.getSyntacticDiagnostics())
    .concat(program.getDeclarationDiagnostics());

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
