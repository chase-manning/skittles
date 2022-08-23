import {
  forEachChild,
  isArrowFunction,
  isMethodDeclaration,
  isParameter,
  MethodDeclaration,
  Node,
  PropertyDeclaration,
  Statement,
} from "typescript";
import { getNodeName, isNodePrivate } from "../helpers/ast-helper";
import { SkittlesMethod, SkittlesParameter } from "../types/skittles-class";
import getSkittlesStatements from "./get-skittles-statements";
import getSkittlesType from "./get-skittles-type";

const getSkittlesParameters = (node: Node): SkittlesParameter[] => {
  const inputs: SkittlesParameter[] = [];
  forEachChild(node, (node) => {
    if (isParameter(node)) {
      inputs.push({
        name: getNodeName(node),
        type: getSkittlesType(node.type),
      });
    }
  });
  return inputs;
};

const getSkittlesMethod = (
  astMethod: MethodDeclaration | PropertyDeclaration
): SkittlesMethod => {
  // Is normal function
  if (isMethodDeclaration(astMethod)) {
    return {
      name: getNodeName(astMethod),
      returns: getSkittlesType(astMethod.type),
      private: isNodePrivate(astMethod),
      view: false, // Temporary, is overriden later with `getStateMutability()`
      parameters: getSkittlesParameters(astMethod),
      statements: getSkittlesStatements(
        astMethod.body,
        getSkittlesType(astMethod.type)
      ),
    };
  }

  // Is arrow function
  if (astMethod.initializer && isArrowFunction(astMethod.initializer)) {
    const arrowFunction = astMethod.initializer;
    return {
      name: getNodeName(astMethod),
      returns: getSkittlesType(arrowFunction.type),
      private: isNodePrivate(astMethod),
      view: false, // Temporary, is overriden later with `getStateMutability()`
      parameters: getSkittlesParameters(arrowFunction),
      statements: getSkittlesStatements(
        arrowFunction.body as Statement,
        getSkittlesType(astMethod.type)
      ),
    };
  }

  throw new Error("Method type is not supported");
};

export default getSkittlesMethod;
