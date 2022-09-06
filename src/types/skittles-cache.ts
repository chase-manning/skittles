import SkittlesContract from "./skittles-contract";

export interface FileCache {
  hash: number;
  contracts: SkittlesContract[];
}

interface SkittlesCache {
  files: Record<string, FileCache>;
}

export default SkittlesCache;
