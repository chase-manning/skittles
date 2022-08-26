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
        return {
          name: i.name,
          type: i.type.kind,
        };
      }),
      stateMutability: "nonpayable",
    },
  ];
};

const getPropertyAbi = (property: SkittlesVariable): AbiFunction => {
  if (property.type.kind === SkittlesTypeKind.Mapping) {
    return {
      type: "function",
      name: property.name,
      inputs: property.type.inputs.map((i) => {
        return {
          name: "",
          type: i.kind,
        };
      }),
      outputs: [{ name: "", type: property.type.output.kind }],
      stateMutability: "view",
    };
  }
  return {
    type: "function",
    name: property.name,
    inputs: [],
    outputs: [{ name: "", type: property.type.kind }],
    stateMutability: "view",
  };
};

const getMethodAbi = (method: SkittlesMethod): AbiFunction => {
  const outputs = () => {
    const { returns } = method;
    if (returns.kind === SkittlesTypeKind.Void) return [];
    if (returns.kind === SkittlesTypeKind.Interface) {
      return [
        ...returns.interface.elements.map((e) => {
          return {
            name: e.name,
            type: e.type.kind,
          };
        }),
      ];
    }
    return [
      {
        name: "",
        type: returns.kind,
      },
    ];
  };

  return {
    type: "function",
    name: method.name,
    inputs: method.parameters.map((i) => {
      return {
        name: i.name,
        type: i.type.kind,
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
