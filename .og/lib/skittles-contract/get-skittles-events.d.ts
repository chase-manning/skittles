import { PropertyDeclaration, TypeNode } from "typescript";
import { SkittlesEventType, SkittlesInterfaces } from "../types/skittles-contract";
export declare const isEvent: (type: TypeNode) => boolean;
declare const getSkittlesEvents: (astProperties: PropertyDeclaration[], interfaces: SkittlesInterfaces) => SkittlesEventType[];
export default getSkittlesEvents;
