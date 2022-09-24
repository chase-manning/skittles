import {
  forEachChild,
  FunctionDeclaration,
  isArrowFunction,
  isMethodDeclaration,
  isParameter,
  MethodDeclaration,
  Node,
  PropertyDeclaration,
  Statement,
  VariableDeclaration,
} from "typescript";
import { getNodeName, isNodePrivate } from "../helpers/ast-helper";
import {
  SkittlesConstants,
  SkittlesEventType,
  SkittlesInterfaces,
  SkittlesMethod,
  SkittlesParameter,
} from "../types/skittles-contract";
import getSkittlesStatements from "./get-skittles-statements";
import getSkittlesType from "./get-skittles-type";

const getSkittlesParameters = (node: Node, interfaces: SkittlesInterfaces): SkittlesParameter[] => {
  const inputs: SkittlesParameter[] = [];
  forEachChild(node, (node) => {
    if (isParameter(node)) {
      inputs.push({
        name: getNodeName(node),
        type: getSkittlesType(node.type, interfaces),
      });
    }
  });
  return inputs;
};

export const getSkittlesMethodFromArrowFunction = (
  astMethod: PropertyDeclaration | VariableDeclaration,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants,
  events: SkittlesEventType[]
): SkittlesMethod => {
  if (!astMethod.initializer || !isArrowFunction(astMethod.initializer)) {
    throw new Error("Expected initializer to be an ArrowFunction");
  }
  const arrowFunction = astMethod.initializer;

  return {
    name: getNodeName(astMethod),
    returns: getSkittlesType(arrowFunction.type, interfaces),
    private: isNodePrivate(astMethod),
    view: false, // Temporary, is overriden later with `getStateMutability()`
    parameters: getSkittlesParameters(arrowFunction, interfaces),
    statements: getSkittlesStatements(
      arrowFunction.body as Statement,
      getSkittlesType(arrowFunction.type, interfaces),
      interfaces,
      constants,
      events
    ),
  };
};

export const getSkittlesMethodFromFunctionDeclaration = (
  astMethod: MethodDeclaration | FunctionDeclaration,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants,
  events: SkittlesEventType[]
): SkittlesMethod => {
  return {
    name: getNodeName(astMethod),
    returns: getSkittlesType(astMethod.type, interfaces),
    private: isNodePrivate(astMethod),
    view: false, // Temporary, is overriden later with `getStateMutability()`
    parameters: getSkittlesParameters(astMethod, interfaces),
    statements: getSkittlesStatements(
      astMethod.body,
      getSkittlesType(astMethod.type, interfaces),
      interfaces,
      constants,
      events
    ),
  };
};

const getSkittlesMethod = (
  astMethod: MethodDeclaration | PropertyDeclaration,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants,
  events: SkittlesEventType[]
): SkittlesMethod => {
  // Is normal function
  if (isMethodDeclaration(astMethod)) {
    return getSkittlesMethodFromFunctionDeclaration(astMethod, interfaces, constants, events);
  }

  // Is arrow function
  if (astMethod.initializer && isArrowFunction(astMethod.initializer)) {
    return getSkittlesMethodFromArrowFunction(astMethod, interfaces, constants, events);
  }

  throw new Error("Method type is not supported");
};

export default getSkittlesMethod;
