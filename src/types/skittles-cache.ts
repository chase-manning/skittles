import { SourceFile } from "typescript";
import SkittlesContract, { SkittlesConstants, SkittlesInterfaces } from "./skittles-contract";

export interface FileCache {
  path: string;
  hash: number;
  dependencies: string[];
  ast: SourceFile;
  contracts: SkittlesContract[];
  interfaces: SkittlesInterfaces;
  constants: SkittlesConstants;
}

interface SkittlesCache {
  version: string;
  files: Record<string, FileCache>;
}

export default SkittlesCache;
