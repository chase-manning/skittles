import type { StateMutability } from "./ir.ts";

// ============================================================
// Build artifacts
// ============================================================

export interface SourceMapping {
  sourceFile: string;
  mappings: Record<number, number>; // solLine (1-based) -> tsLine (1-based)
}

export interface BuildArtifact {
  contractName: string;
  solidity: string;
  sourceMap?: SourceMapping;
}

export interface AbiItem {
  type: "function" | "event" | "constructor" | "fallback" | "receive";
  name?: string;
  inputs?: AbiParameter[];
  outputs?: AbiParameter[];
  stateMutability?: StateMutability;
  anonymous?: boolean;
}

export interface AbiParameter {
  name: string;
  type: string;
  indexed?: boolean;
  components?: AbiParameter[];
}
