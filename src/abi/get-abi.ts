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
          throw new Error("Unexpected type kind 8");
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
      throw new Error("Unexpected type kind 9");
    }
    return {
      type: "function",
      name: property.name,
      inputs: property.type.inputs.map((i) => {
        if (i.kind !== SkittlesTypeKind.Simple) {
          throw new Error("Unexpected type kind 10");
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
  const outputs = () => {
    const { returns } = method;
    if (returns.kind === SkittlesTypeKind.Void) return [];
    if (returns.kind === SkittlesTypeKind.Simple)
      return [
        {
          name: "",
          type: returns.value,
        },
      ];
    if (returns.kind === SkittlesTypeKind.Interface)
      return [
        ...returns.interface.elements.map((e) => {
          if (e.type.kind !== SkittlesTypeKind.Simple) {
            throw new Error("Nested return types not supported");
          }
          return {
            name: e.name,
            type: e.type.value,
          };
        }),
      ];
    throw new Error("Missing return type in getMethodAbi in get-abi");
  };
  return {
    type: "function",
    name: method.name,
    inputs: method.parameters.map((i) => {
      if (i.type.kind !== SkittlesTypeKind.Simple) {
        throw new Error("Unexpected type kind 11");
      }
      return {
        name: i.name,
        type: i.type.value,
      };
    }),
    outputs: outputs(),
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
