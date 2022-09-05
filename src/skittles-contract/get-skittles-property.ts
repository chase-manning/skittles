import { PropertyDeclaration } from "typescript";
import {
  getNodeName,
  isNodeImmutable,
  isNodePrivate,
} from "../helpers/ast-helper";
import {
  SkittlesConstants,
  SkittlesInterfaces,
  SkittlesVariable,
} from "../types/skittles-contract";
import getSkittlesExpression from "./get-skittles-expression";
import getSkittlesType from "./get-skittles-type";

const getSkittlesProperty = (
  astProperty: PropertyDeclaration,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesVariable => {
  if (!astProperty.type) throw new Error("Could not get property type");
  const initializer = astProperty.initializer;
  const value = initializer
    ? getSkittlesExpression(initializer, interfaces, constants)
    : undefined;
  return {
    name: getNodeName(astProperty),
    type: getSkittlesType(astProperty.type, interfaces, value),
    value,
    private: isNodePrivate(astProperty),
    immutable: isNodeImmutable(astProperty),
  };
};

export default getSkittlesProperty;
