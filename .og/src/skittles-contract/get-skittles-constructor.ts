import { ConstructorDeclaration, ParameterDeclaration } from "typescript";
import { getNodeName } from "../helpers/ast-helper";
import {
  SkittlesConstants,
  SkittlesConstructor,
  SkittlesEventType,
  SkittlesInterfaces,
} from "../types/skittles-contract";
import getSkittlesStatements from "./get-skittles-statements";
import getSkittlesType from "./get-skittles-type";

const getSkittlesConstructor = (
  astConstructor: ConstructorDeclaration,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants,
  events: SkittlesEventType[]
): SkittlesConstructor => {
  return {
    parameters: astConstructor.parameters.map((parameter: ParameterDeclaration) => {
      return {
        name: getNodeName(parameter),
        type: getSkittlesType(parameter.type, interfaces),
      };
    }),
    statements: getSkittlesStatements(
      astConstructor.body,
      getSkittlesType(astConstructor.type, interfaces),
      interfaces,
      constants,
      events
    ),
  };
};
export default getSkittlesConstructor;
