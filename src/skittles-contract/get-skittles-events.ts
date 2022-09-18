import { PropertyDeclaration, SyntaxKind, TypeNode } from "typescript";
import { getNodeName } from "../helpers/ast-helper";
import { SkittlesEventType, SkittlesInterfaces } from "../types/skittles-contract";

export const isEvent = (type: TypeNode): boolean => {
  const { kind } = type;
  if (!kind) return false;
  if (kind !== SyntaxKind.TypeReference) return false;
  return (type as any).typeName.escapedText === "SkittlesEvent";
};

const getSkittlesEvents = (
  astProperties: PropertyDeclaration[],
  interfaces: SkittlesInterfaces
): SkittlesEventType[] => {
  const events: SkittlesEventType[] = [];
  for (const astProperty of astProperties) {
    const { type } = astProperty;
    if (!type) continue;
    if (!isEvent(type)) continue;
    const { typeArguments } = type as any;
    if (!typeArguments || typeArguments.length !== 1) {
      throw new Error("Could not get type arguments");
    }
    const parametersInterface = typeArguments[0];
    if (parametersInterface.kind !== SyntaxKind.TypeReference) {
      throw new Error("Could type arguments not interface");
    }

    const interfaceName = parametersInterface.typeName.escapedText;
    const params = interfaces[interfaceName];
    if (!params) throw new Error(`Could not find interface: ${interfaceName}`);
    events.push({
      label: getNodeName(astProperty.name),
      parameters: params.elements,
    });
  }
  return events;
};

export default getSkittlesEvents;
