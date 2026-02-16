import { PropertyDeclaration } from "typescript";
import { SkittlesConstants, SkittlesInterfaces, SkittlesVariable } from "../types/skittles-contract";
declare const getSkittlesVariables: (astPropertes: PropertyDeclaration[], interfaces: SkittlesInterfaces, constants: SkittlesConstants) => SkittlesVariable[];
export default getSkittlesVariables;
