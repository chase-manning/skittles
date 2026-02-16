import { SourceFile } from "typescript";
import SkittlesContract, {
  SkittlesConstants,
  SkittlesInterfaces,
  SkittlesMethod,
} from "./skittles-contract";

export interface FileCache {
  hash: number;
  dependencies: string[];
  ast: SourceFile;
  contracts: SkittlesContract[];
  interfaces: SkittlesInterfaces;
  constants: SkittlesConstants;
  functions: SkittlesMethod[];
}

interface SkittlesCache {
  version: string;
  files: Record<string, FileCache>;
}

export default SkittlesCache;
