import { Node } from "typescript";
import { SkittlesInterfaces } from "../types/skittles-contract";
import { SkittlesType } from "../types/skittles-type";
declare const getSkittlesType: (type: Node | undefined, interfaces: SkittlesInterfaces, value?: any) => SkittlesType;
export default getSkittlesType;
