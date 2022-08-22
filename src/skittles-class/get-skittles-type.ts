import { isAddress } from "ethers/lib/utils";
import { Node, SyntaxKind } from "typescript";

const getSkittlesType = (type: Node | undefined, value?: any): string => {
  if (!type) return "void";
  const { kind } = type;
  if (!kind) return "void";
  switch (kind) {
    case SyntaxKind.StringKeyword:
      if (!value) return "string";
      if (isAddress(value)) return "address";
      return "string";
    case SyntaxKind.StringLiteral:
      if (!value) return "string";
      if (isAddress(value)) return "address";
      return "string";
    case SyntaxKind.NumberKeyword:
      return "uint256";
    case SyntaxKind.NumericLiteral:
      return "uint256";
    case SyntaxKind.BooleanKeyword:
      return "bool";
    case SyntaxKind.VoidKeyword:
      return "void";
    case SyntaxKind.AnyKeyword:
      return "any";
    case SyntaxKind.TypeReference:
      const { typeName } = type as any;
      if (!typeName) throw new Error("Could not get type name");
      const { escapedText } = typeName;
      if (!escapedText) throw new Error("Could not get type escaped text");
      switch (escapedText) {
        case "address":
          return "address";
        case "Record":
          const { typeArguments } = type as any;
          return `mapping(${getSkittlesType(
            typeArguments[0]
          )},${getSkittlesType(typeArguments[1])})`;
        default:
          throw new Error(`Unknown type reference type: ${escapedText}`);
      }
    default:
      throw new Error(`Unknown syntax kind: ${kind}`);
  }
};

export default getSkittlesType;
