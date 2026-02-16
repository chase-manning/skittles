import { FileData } from "../compiler/get-file-data";
export declare const getAllFilesInDirectory: (dir: string) => string[];
export declare const getAllTypescriptFiles: () => string[];
export declare const updateCache: (fileData: FileData[]) => void;
export declare const writeBuildFile: (fileName: string, content: string, subDirectory?: string) => void;
export declare const readFile: (filePath: string) => string;
export declare const clearDirectory: (directory: string) => void;
export declare const getContractName: (fileName: string) => string;
export declare const relativePathToAbsolute: (importPath: string, sourcePath: string) => string;
