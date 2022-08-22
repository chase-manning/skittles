import { PropertyDeclaration } from "typescript";
import {
  getNodeName,
  isNodeImmutable,
  isNodePrivate,
} from "../helpers/ast-helper";
import { SkittlesVariable } from "../types/skittles-class";
import getSkittlesExpression from "./get-skittles-expression";
import getSkittlesType from "./get-skittles-type";

const getSkittlesProperty = (
  astProperty: PropertyDeclaration
): SkittlesVariable => {
  if (!astProperty.type) throw new Error("Could not get property type");
  const initializer = astProperty.initializer;
  const value = initializer ? getSkittlesExpression(initializer) : undefined;
  return {
    name: getNodeName(astProperty),
    type: getSkittlesType(astProperty.type, value),
    value,
    private: isNodePrivate(astProperty),
    immutable: isNodeImmutable(astProperty),
  };
};

export default getSkittlesProperty;
