import { ConstructorDeclaration } from "typescript";
import { SkittlesConstants, SkittlesConstructor, SkittlesEventType, SkittlesInterfaces } from "../types/skittles-contract";
declare const getSkittlesConstructor: (astConstructor: ConstructorDeclaration, interfaces: SkittlesInterfaces, constants: SkittlesConstants, events: SkittlesEventType[]) => SkittlesConstructor;
export default getSkittlesConstructor;
