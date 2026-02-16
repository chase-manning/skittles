"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeFunctions = exports.mergeConstants = exports.mergeInterfaces = exports.mergeDependencies = void 0;
/**
 * Merges dependencies of a specific type from dependency files into the current file data.
 * Creates new objects instead of mutating the input to avoid side effects.
 * @param fileData - The file data to merge dependencies into
 * @param getDependencyData - Function to extract the dependency data from a FileData object
 * @param mergeFunction - Function to merge dependency data into the current data
 * @param createCopy - Function to create a copy of the current data
 * @param propertyName - The property name to update in the returned FileData object
 * @returns FileData array with merged dependencies (new objects, input is not mutated)
 */
const mergeDependencies = (fileData, getDependencyData, mergeFunction, createCopy, propertyName) => {
    // Create a Map for O(1) lookups instead of O(n) find() operations
    const fileMap = new Map(fileData.map((f) => [f.path, f]));
    return fileData.map((data) => {
        if (!data.changed)
            return data;
        const currentData = getDependencyData(data);
        const mergedData = createCopy(currentData);
        data.dependencies.forEach((dep) => {
            const depData = fileMap.get(dep);
            if (!depData) {
                throw new Error(`Dependency ${dep} not found`);
            }
            const depDependencyData = getDependencyData(depData);
            mergeFunction(mergedData, depDependencyData);
        });
        return {
            ...data,
            [propertyName]: mergedData,
        };
    });
};
exports.mergeDependencies = mergeDependencies;
/**
 * Merges interfaces from dependencies into the current file's interfaces.
 * Returns new FileData objects without mutating the input.
 */
const mergeInterfaces = (fileData) => {
    return (0, exports.mergeDependencies)(fileData, (data) => data.interfaces, (current, dependency) => {
        Object.keys(dependency).forEach((key) => {
            current[key] = dependency[key];
        });
    }, (interfaces) => ({ ...interfaces }), "interfaces");
};
exports.mergeInterfaces = mergeInterfaces;
/**
 * Merges constants from dependencies into the current file's constants.
 * Returns new FileData objects without mutating the input.
 */
const mergeConstants = (fileData) => {
    return (0, exports.mergeDependencies)(fileData, (data) => data.constants, (current, dependency) => {
        Object.keys(dependency).forEach((key) => {
            current[key] = dependency[key];
        });
    }, (constants) => ({ ...constants }), "constants");
};
exports.mergeConstants = mergeConstants;
/**
 * Merges functions from dependencies into the current file's functions.
 * Returns new FileData objects without mutating the input.
 */
const mergeFunctions = (fileData) => {
    return (0, exports.mergeDependencies)(fileData, (data) => data.functions, (current, dependency) => {
        dependency.forEach((func) => {
            current.push(func);
        });
    }, (functions) => [...functions], "functions");
};
exports.mergeFunctions = mergeFunctions;
