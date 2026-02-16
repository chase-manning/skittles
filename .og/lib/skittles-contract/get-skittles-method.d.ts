import { FunctionDeclaration, MethodDeclaration, PropertyDeclaration, VariableDeclaration } from "typescript";
import { SkittlesConstants, SkittlesEventType, SkittlesInterfaces, SkittlesMethod } from "../types/skittles-contract";
export declare const getSkittlesMethodFromArrowFunction: (astMethod: PropertyDeclaration | VariableDeclaration, interfaces: SkittlesInterfaces, constants: SkittlesConstants, events: SkittlesEventType[]) => SkittlesMethod;
export declare const getSkittlesMethodFromFunctionDeclaration: (astMethod: MethodDeclaration | FunctionDeclaration, interfaces: SkittlesInterfaces, constants: SkittlesConstants, events: SkittlesEventType[]) => SkittlesMethod;
declare const getSkittlesMethod: (astMethod: MethodDeclaration | PropertyDeclaration, interfaces: SkittlesInterfaces, constants: SkittlesConstants, events: SkittlesEventType[]) => SkittlesMethod;
export default getSkittlesMethod;
