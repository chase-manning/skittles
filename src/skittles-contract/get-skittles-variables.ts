import { PropertyDeclaration } from "typescript";
import { getNodeName, isNodeImmutable, isNodePrivate } from "../helpers/ast-helper";
import {
  SkittlesConstants,
  SkittlesInterfaces,
  SkittlesVariable,
} from "../types/skittles-contract";
import { isEvent } from "./get-skittles-events";
import getSkittlesExpression from "./get-skittles-expression";
import getSkittlesType from "./get-skittles-type";

const getSkittlesVariables = (
  astPropertes: PropertyDeclaration[],
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesVariable[] => {
  const vars: SkittlesVariable[] = [];
  for (const astProperty of astPropertes) {
    const { type } = astProperty;
    if (!type) throw new Error("Could not get property type");
    if (isEvent(type)) continue;
    const initializer = astProperty.initializer;
    const value = initializer
      ? getSkittlesExpression(initializer, interfaces, constants)
      : undefined;
    vars.push({
      name: getNodeName(astProperty),
      type: getSkittlesType(type, interfaces, value),
      value,
      private: isNodePrivate(astProperty),
      immutable: isNodeImmutable(astProperty),
    });
  }
  return vars;
};

export default getSkittlesVariables;
