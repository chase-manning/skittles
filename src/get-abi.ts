import SkittlesClass, {
  SkittlesMethod,
  SkittlesVariable,
} from "./types/skittles-class";

export interface AbiParameter {
  name: string;
  type: string; // TODO Add subtypes
}

export interface AbiFunction {
  type: "function" | "constructor" | "receive" | "fallback";
  name: string;
  inputs: AbiParameter[];
  outputs: AbiParameter[];
  stateMutability: "view" | "payable" | "nonpayable" | "pure";
}

export type Abi = AbiFunction[];

const getPropertyAbi = (property: SkittlesVariable): AbiFunction => {
  return {
    type: "function",
    name: property.name,
    inputs: [],
    outputs: [{ name: "", type: property.type }],
    stateMutability: "view",
  };
};

const getMethodAbi = (method: SkittlesMethod): AbiFunction => {
  return {
    type: "function",
    name: method.name,
    inputs: method.parameters.map((i) => ({
      name: i.name,
      type: i.type,
    })),
    outputs: [{ name: "", type: method.returns }],
    stateMutability: method.view ? "view" : "payable",
  };
};

const getAbi = (skittlesClass: SkittlesClass): Abi => {
  return [
    ...skittlesClass.variables.filter((p) => !p.private).map(getPropertyAbi),
    ...skittlesClass.methods.filter((p) => !p.private).map(getMethodAbi),
  ];
};

export default getAbi;
