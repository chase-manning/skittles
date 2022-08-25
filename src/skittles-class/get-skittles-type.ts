import { isAddress } from "ethers/lib/utils";
import { Node, SyntaxKind } from "typescript";
import { SkittlesType, SkittlesTypeKind } from "../types/skittles-class";

const kind = SkittlesTypeKind.Simple;
const stringType: SkittlesType = { kind, value: "string" };
const addressType: SkittlesType = { kind, value: "address" };
const uint256Type: SkittlesType = { kind, value: "uint256" };
const boolType: SkittlesType = { kind, value: "bool" };
const anyType: SkittlesType = { kind, value: "any" };

const getSkittlesType = (type: Node | undefined, value?: any): SkittlesType => {
  if (!type) return { kind: SkittlesTypeKind.Void };
  const { kind } = type;
  if (!kind) return { kind: SkittlesTypeKind.Void };
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
      return { kind: SkittlesTypeKind.Void };
    case SyntaxKind.AnyKeyword:
      return anyType;
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
            inputs.push(getSkittlesType(input));
            record = output;
          }

          return {
            kind: SkittlesTypeKind.Mapping,
            inputs,
            output: getSkittlesType(record),
          };
        default:
          throw new Error(`Unknown type reference type: ${escapedText}`);
      }
    default:
      throw new Error(`Unknown syntax kind: ${kind}`);
  }
};

export default getSkittlesType;
