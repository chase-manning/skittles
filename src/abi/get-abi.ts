import { Abi, AbiFunction } from "../types/abi-types";
import SkittlesClass, {
  SkittlesConstructor,
  SkittlesMethod,
  SkittlesType,
  SkittlesTypeKind,
  SkittlesVariable,
} from "../types/skittles-class";

const getTypeString = (type: SkittlesType): string => {
  return type.kind;
};

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
          type: getTypeString(i.type),
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
          type: getTypeString(i),
        };
      }),
      outputs: [{ name: "", type: getTypeString(property.type.output) }],
      stateMutability: "view",
    };
  }
  if (property.type.kind === SkittlesTypeKind.Array) {
    return {
      type: "function",
      name: property.name,
      inputs: [
        {
          name: "index",
          type: "uint256",
        },
      ],
      outputs: [{ name: "", type: getTypeString(property.type.itemType) }],
      stateMutability: "view",
    };
  }
  return {
    type: "function",
    name: property.name,
    inputs: [],
    outputs: [{ name: "", type: getTypeString(property.type) }],
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
            type: getTypeString(e.type),
          };
        }),
      ];
    }
    return [
      {
        name: "",
        type: getTypeString(returns),
      },
    ];
  };

  return {
    type: "function",
    name: method.name,
    inputs: method.parameters.map((i) => {
      return {
        name: i.name,
        type: getTypeString(i.type),
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
