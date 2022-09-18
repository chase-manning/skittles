import { forEachChild, isVariableStatement, SourceFile } from "typescript";
import { getNodeName } from "../helpers/ast-helper";
import { SkittlesConstants, SkittlesInterfaces } from "../types/skittles-contract";
import getSkittlesExpression from "./get-skittles-expression";

const getSkittlesConstants = (ast: SourceFile, interfaces: SkittlesInterfaces) => {
  const constants: SkittlesConstants = {};
  forEachChild(ast, (child) => {
    if (isVariableStatement(child)) {
      const { declarations } = child.declarationList;
      declarations.forEach((declaration) => {
        const { name, initializer } = declaration;
        if (initializer) {
          const variableName: string = getNodeName(name);
          constants[variableName] = getSkittlesExpression(initializer, interfaces, constants);
        }
      });
    }
  });
  return constants;
};

export default getSkittlesConstants;
