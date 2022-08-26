import { isAddress } from "ethers/lib/utils";
import { Node, SyntaxKind } from "typescript";
import {
  SkittlesInterfaces,
  SkittlesType,
  SkittlesTypeKind,
} from "../types/skittles-class";

const stringType: SkittlesType = { kind: SkittlesTypeKind.String };
const addressType: SkittlesType = { kind: SkittlesTypeKind.Address };
const uint256Type: SkittlesType = { kind: SkittlesTypeKind.Number };
const boolType: SkittlesType = { kind: SkittlesTypeKind.Boolean };
const voidType: SkittlesType = { kind: SkittlesTypeKind.Void };

const getSkittlesType = (
  type: Node | undefined,
  interfaces: SkittlesInterfaces,
  value?: any
): SkittlesType => {
  if (!type) return voidType;
  const { kind } = type;
  if (!kind) return voidType;
  switch (kind) {
    case SyntaxKind.StringKeyword:
      if (!value) return stringType;
      if (isAddress(value)) return addressType;
      return stringType;
    case SyntaxKind.StringLiteral:
      if (!value) return stringType;
      if (isAddress(value)) return addressType;
      return stringType;
    case SyntaxKind.NumberKeyword:
      return uint256Type;
    case SyntaxKind.NumericLiteral:
      return uint256Type;
    case SyntaxKind.BooleanKeyword:
      return boolType;
    case SyntaxKind.VoidKeyword:
      return voidType;
    case SyntaxKind.AnyKeyword:
      throw new Error("Any type not supported");
    case SyntaxKind.TypeReference:
      const { typeName } = type as any;
      if (!typeName) throw new Error("Could not get type name");
      const { escapedText } = typeName;
      if (!escapedText) throw new Error("Could not get type escaped text");
      switch (escapedText) {
        case "address":
          return addressType;
        case "Record":
          let record = type as any;
          const inputs: SkittlesType[] = [];
          while (
            record.kind === SyntaxKind.TypeReference &&
            record.typeName &&
            record.typeName.escapedText &&
            record.typeName.escapedText === "Record"
          ) {
            const { typeArguments } = record;
            if (!typeArguments || typeArguments.length !== 2) {
              throw new Error("Could not get type arguments");
            }
            const [input, output] = typeArguments;
            inputs.push(getSkittlesType(input, interfaces));
            record = output;
          }

          return {
            kind: SkittlesTypeKind.Mapping,
            inputs,
            output: getSkittlesType(record, interfaces),
          };
        default:
          const face = interfaces[escapedText];
          if (!face) throw new Error(`Could not find interface ${escapedText}`);
          return {
            kind: SkittlesTypeKind.Interface,
            interface: face,
          };
      }
    default:
      throw new Error(`Unknown syntax kind: ${kind}`);
  }
};

export default getSkittlesType;
