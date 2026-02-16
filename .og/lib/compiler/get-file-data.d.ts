import { SourceFile } from "typescript";
import SkittlesCache from "../types/skittles-cache";
import SkittlesContract, { SkittlesConstants, SkittlesInterfaces, SkittlesMethod } from "../types/skittles-contract";
export interface FileData {
    path: string;
    hash: number;
    fileContent: string;
    changed: boolean;
    dependencies: string[];
    ast: SourceFile;
    constants: SkittlesConstants;
    interfaces: SkittlesInterfaces;
    functions: SkittlesMethod[];
    contracts: SkittlesContract[];
}
declare const getFileData: (cache: SkittlesCache) => FileData[];
export default getFileData;
