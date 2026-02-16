import { Statement } from "typescript";
import { SkittlesConstants, SkittlesEventType, SkittlesInterfaces } from "../types/skittles-contract";
import { SkittlesType } from "../types/skittles-type";
import { SkittlesStatement } from "../types/skittles-statement";
declare const getSkittlesStatements: (block: Statement | undefined, returnType: SkittlesType, interfaces: SkittlesInterfaces, constants: SkittlesConstants, events: SkittlesEventType[]) => SkittlesStatement[];
export default getSkittlesStatements;
