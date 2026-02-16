import SkittlesContract, { SkittlesVariable } from "../types/skittles-contract";
interface StorageLayoutResponse {
    yul: string[];
    slot: number;
}
declare const addStorageLayout: (yul: string[], property: SkittlesVariable, contract: SkittlesContract, slot: number) => StorageLayoutResponse;
export default addStorageLayout;
