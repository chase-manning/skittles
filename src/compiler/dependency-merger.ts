import { FileData } from "./get-file-data";
import { SkittlesConstants, SkittlesInterfaces, SkittlesMethod } from "../types/skittles-contract";

/**
 * Merges dependencies of a specific type from dependency files into the current file data.
 * @param fileData - The file data to merge dependencies into
 * @param getDependencyData - Function to extract the dependency data from a FileData object
 * @param mergeFunction - Function to merge dependency data into the current data
 * @returns FileData array with merged dependencies
 */
export const mergeDependencies = <T>(
  fileData: FileData[],
  getDependencyData: (data: FileData) => T,
  mergeFunction: (current: T, dependency: T) => void
): FileData[] => {
  return fileData.map((data) => {
    if (!data.changed) return data;

    const currentData = getDependencyData(data);
    data.dependencies.forEach((dep) => {
      const depData = fileData.find((f) => f.path === dep);
      if (!depData) {
        throw new Error(`Dependency ${dep} not found`);
      }
      const depDependencyData = getDependencyData(depData);
      mergeFunction(currentData, depDependencyData);
    });

    return data;
  });
};

/**
 * Merges interfaces from dependencies into the current file's interfaces.
 */
export const mergeInterfaces = (fileData: FileData[]): FileData[] => {
  return mergeDependencies(
    fileData,
    (data) => data.interfaces,
    (current, dependency) => {
      Object.keys(dependency).forEach((key) => {
        current[key] = dependency[key];
      });
    }
  );
};

/**
 * Merges constants from dependencies into the current file's constants.
 */
export const mergeConstants = (fileData: FileData[]): FileData[] => {
  return mergeDependencies(
    fileData,
    (data) => data.constants,
    (current, dependency) => {
      Object.keys(dependency).forEach((key) => {
        current[key] = dependency[key];
      });
    }
  );
};

/**
 * Merges functions from dependencies into the current file's functions.
 */
export const mergeFunctions = (fileData: FileData[]): FileData[] => {
  return mergeDependencies(
    fileData,
    (data) => data.functions,
    (current, dependency) => {
      dependency.forEach((func) => {
        current.push(func);
      });
    }
  );
};
