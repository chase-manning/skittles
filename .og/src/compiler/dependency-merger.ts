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
export const mergeDependencies = <T>(
  fileData: FileData[],
  getDependencyData: (data: FileData) => T,
  mergeFunction: (current: T, dependency: T) => void,
  createCopy: (data: T) => T,
  propertyName: keyof FileData
): FileData[] => {
  // Create a Map for O(1) lookups instead of O(n) find() operations
  const fileMap = new Map(fileData.map((f) => [f.path, f]));

  return fileData.map((data) => {
    if (!data.changed) return data;

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

/**
 * Merges interfaces from dependencies into the current file's interfaces.
 * Returns new FileData objects without mutating the input.
 */
export const mergeInterfaces = (fileData: FileData[]): FileData[] => {
  return mergeDependencies(
    fileData,
    (data) => data.interfaces,
    (current, dependency) => {
      Object.keys(dependency).forEach((key) => {
        current[key] = dependency[key];
      });
    },
    (interfaces) => ({ ...interfaces }),
    "interfaces"
  );
};

/**
 * Merges constants from dependencies into the current file's constants.
 * Returns new FileData objects without mutating the input.
 */
export const mergeConstants = (fileData: FileData[]): FileData[] => {
  return mergeDependencies(
    fileData,
    (data) => data.constants,
    (current, dependency) => {
      Object.keys(dependency).forEach((key) => {
        current[key] = dependency[key];
      });
    },
    (constants) => ({ ...constants }),
    "constants"
  );
};

/**
 * Merges functions from dependencies into the current file's functions.
 * Returns new FileData objects without mutating the input.
 */
export const mergeFunctions = (fileData: FileData[]): FileData[] => {
  return mergeDependencies(
    fileData,
    (data) => data.functions,
    (current, dependency) => {
      dependency.forEach((func) => {
        current.push(func);
      });
    },
    (functions) => [...functions],
    "functions"
  );
};
