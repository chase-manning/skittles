import { Abi, AbiFunction } from "../types/abi-types";
import SkittlesClass, {
  SkittlesConstructor,
  SkittlesMethod,
  SkittlesTypeKind,
  SkittlesVariable,
} from "../types/skittles-class";

const getConstructorAbi = (
  constructor?: SkittlesConstructor
): AbiFunction[] => {
  if (!constructor) return [];
  return [
    {
      type: "constructor",
      inputs: constructor.parameters.map((i) => {
        if (i.type.kind !== SkittlesTypeKind.Simple) {
          throw new Error("Unexpected type kind");
        }
        return {
          name: i.name,
          type: i.type.value,
        };
      }),
      stateMutability: "nonpayable",
    },
  ];
};

const getPropertyAbi = (property: SkittlesVariable): AbiFunction => {
  if (property.type.kind === SkittlesTypeKind.Simple) {
    return {
      type: "function",
      name: property.name,
      inputs: [],
      outputs: [{ name: "", type: property.type.value }],
      stateMutability: "view",
    };
  }
  if (property.type.kind === SkittlesTypeKind.Mapping) {
    if (property.type.output.kind !== SkittlesTypeKind.Simple) {
      throw new Error("Unexpected type kind");
    }
    return {
      type: "function",
      name: property.name,
      inputs: property.type.inputs.map((i) => {
        if (i.kind !== SkittlesTypeKind.Simple) {
          throw new Error("Unexpected type kind");
        }
        return {
          name: "",
          type: i.value,
        };
      }),
      outputs: [{ name: "", type: property.type.output.value }],
      stateMutability: "view",
    };
  }
  throw new Error("Property abi type not supported");
};

const getMethodAbi = (method: SkittlesMethod): AbiFunction => {
  const returnType =
    method.returns.kind === SkittlesTypeKind.Void
      ? "void"
      : method.returns.kind === SkittlesTypeKind.Simple
      ? method.returns.value
      : "error";
  return {
    type: "function",
    name: method.name,
    inputs: method.parameters.map((i) => {
      if (i.type.kind !== SkittlesTypeKind.Simple) {
        throw new Error("Unexpected type kind");
      }
      return {
        name: i.name,
        type: i.type.value,
      };
    }),
    outputs: [{ name: "", type: returnType }],
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
