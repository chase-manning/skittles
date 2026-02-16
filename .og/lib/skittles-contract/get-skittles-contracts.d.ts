import { SourceFile } from "typescript";
import SkittlesContract, { SkittlesConstants, SkittlesInterfaces, SkittlesMethod } from "../types/skittles-contract";
declare const getSkittlesContracts: (ast: SourceFile, interfaces: SkittlesInterfaces, constants: SkittlesConstants, functions: SkittlesMethod[]) => SkittlesContract[];
export default getSkittlesContracts;
