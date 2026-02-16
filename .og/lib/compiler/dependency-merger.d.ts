import { FileData } from "./get-file-data";
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
export declare const mergeDependencies: <T>(fileData: FileData[], getDependencyData: (data: FileData) => T, mergeFunction: (current: T, dependency: T) => void, createCopy: (data: T) => T, propertyName: keyof FileData) => FileData[];
/**
 * Merges interfaces from dependencies into the current file's interfaces.
 * Returns new FileData objects without mutating the input.
 */
export declare const mergeInterfaces: (fileData: FileData[]) => FileData[];
/**
 * Merges constants from dependencies into the current file's constants.
 * Returns new FileData objects without mutating the input.
 */
export declare const mergeConstants: (fileData: FileData[]) => FileData[];
/**
 * Merges functions from dependencies into the current file's functions.
 * Returns new FileData objects without mutating the input.
 */
export declare const mergeFunctions: (fileData: FileData[]) => FileData[];
