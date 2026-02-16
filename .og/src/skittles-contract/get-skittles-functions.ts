import {
  forEachChild,
  isArrowFunction,
  isFunctionDeclaration,
  isVariableStatement,
  SourceFile,
} from "typescript";
import {
  SkittlesConstants,
  SkittlesEventType,
  SkittlesInterfaces,
  SkittlesMethod,
} from "../types/skittles-contract";
import {
  getSkittlesMethodFromArrowFunction,
  getSkittlesMethodFromFunctionDeclaration,
} from "./get-skittles-method";

const getSkittlesFunctions = (
  ast: SourceFile,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants,
  events: SkittlesEventType[]
) => {
  const functions: SkittlesMethod[] = [];
  forEachChild(ast, (child) => {
    if (isVariableStatement(child)) {
      const { declarations } = child.declarationList;
      declarations.forEach((declaration) => {
        const { initializer } = declaration;
        if (initializer) {
          if (isArrowFunction(initializer)) {
            functions.push(
              getSkittlesMethodFromArrowFunction(declaration, interfaces, constants, events)
            );
          }
        }
      });
    }
    if (isFunctionDeclaration(child)) {
      functions.push(
        getSkittlesMethodFromFunctionDeclaration(child, interfaces, constants, events)
      );
    }
  });
  return functions;
};

export default getSkittlesFunctions;
