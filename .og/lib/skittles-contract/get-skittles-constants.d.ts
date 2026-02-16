import { SourceFile } from "typescript";
import { SkittlesConstants, SkittlesInterfaces } from "../types/skittles-contract";
declare const getSkittlesConstants: (ast: SourceFile, interfaces: SkittlesInterfaces) => SkittlesConstants;
export default getSkittlesConstants;
