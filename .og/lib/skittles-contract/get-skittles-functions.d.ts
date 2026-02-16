import { SourceFile } from "typescript";
import { SkittlesConstants, SkittlesEventType, SkittlesInterfaces, SkittlesMethod } from "../types/skittles-contract";
declare const getSkittlesFunctions: (ast: SourceFile, interfaces: SkittlesInterfaces, constants: SkittlesConstants, events: SkittlesEventType[]) => SkittlesMethod[];
export default getSkittlesFunctions;
