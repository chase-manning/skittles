import SkittlesContract, { SkittlesVariable } from "../types/skittles-contract";
declare const addStorageAccess: (yul: string[], property: SkittlesVariable, contract: SkittlesContract) => string[];
export default addStorageAccess;
