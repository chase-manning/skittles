import { Abi, AbiFunction } from "../types/abi-types";
import SkittlesClass, {
  SkittlesConstructor,
  SkittlesMethod,
  SkittlesVariable,
} from "../types/skittles-class";

const getConstructorAbi = (
  constructor?: SkittlesConstructor
): AbiFunction[] => {
  if (!constructor) return [];
  return [
    {
      type: "constructor",
      inputs: constructor.parameters.map((i) => ({
        name: i.name,
        type: i.type,
      })),
      stateMutability: "nonpayable",
    },
  ];
};

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
    ...getConstructorAbi(skittlesClass.constructor),
    ...skittlesClass.variables.filter((p) => !p.private).map(getPropertyAbi),
    ...skittlesClass.methods.filter((p) => !p.private).map(getMethodAbi),
  ];
};

export default getAbi;
