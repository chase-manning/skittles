import { ConstructorDeclaration, ParameterDeclaration } from "typescript";
import { getNodeName } from "../helpers/ast-helper";
import {
  SkittlesConstructor,
  SkittlesInterfaces,
} from "../types/skittles-class";
import getSkittlesStatements from "./get-skittles-statements";
import getSkittlesType from "./get-skittles-type";

const getSkittlesConstructor = (
  astConstructor: ConstructorDeclaration,
  interfaces: SkittlesInterfaces
): SkittlesConstructor => {
  return {
    parameters: astConstructor.parameters.map(
      (parameter: ParameterDeclaration) => {
        return {
          name: getNodeName(parameter),
          type: getSkittlesType(parameter.type, interfaces),
        };
      }
    ),
    statements: getSkittlesStatements(
      astConstructor.body,
      getSkittlesType(astConstructor.type, interfaces),
      interfaces
    ),
  };
};
export default getSkittlesConstructor;
