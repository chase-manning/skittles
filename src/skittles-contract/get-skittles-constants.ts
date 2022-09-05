import {
  forEachChild,
  isImportDeclaration,
  isNamedImports,
  isVariableStatement,
  SourceFile,
} from "typescript";
import getAst from "../ast/get-ast";
import { getNodeName } from "../helpers/ast-helper";
import { SkittlesInterfaces } from "../types/skittles-contract";
import { SkittlesExpression } from "../types/skittles-expression";
import getSkittlesExpression from "./get-skittles-expression";
import fs from "fs";

const relativePathToAbsolute = (path: string, sourcePath: string) => {
  const sourcePathParts = sourcePath.split("/");
  const pathParts = path.split("/");
  let sourcePathIndex = sourcePathParts.length - 1;
  let pathIndex = 0;
  while (pathParts[pathIndex] === "..") {
    sourcePathIndex--;
    pathIndex++;
  }
  const newPathParts = sourcePathParts.slice(0, sourcePathIndex);
  newPathParts.push(...pathParts.slice(pathIndex));
  return newPathParts.join("/") + ".ts";
};

const getSkittlesConstants = (
  ast: SourceFile,
  interfaces: SkittlesInterfaces,
  sourceFile: string
) => {
  const constants: Record<string, SkittlesExpression> = {};
  forEachChild(ast, (child) => {
    // Handling imports
    if (isImportDeclaration(child)) {
      const { importClause } = child;
      const module = getNodeName(child.moduleSpecifier);
      if (module === "skittles") return;
      const modifiedModule = relativePathToAbsolute(module, sourceFile);
      const ast = getAst(modifiedModule);
      if (!importClause) throw new Error("Could not get import clause");
      const { namedBindings } = importClause;
      if (!namedBindings) throw new Error("Could not get named bindings");
      if (!isNamedImports(namedBindings)) {
        throw new Error("Could not get named exports");
      }
      const varNames = namedBindings.elements.map((element) =>
        getNodeName(element.name)
      );
      // TODO there is some duplication here with the below
      forEachChild(ast, (child) => {
        if (isVariableStatement(child)) {
          const { declarations } = child.declarationList;
          declarations.forEach((declaration) => {
            const { name, initializer } = declaration;
            if (initializer && varNames.includes(getNodeName(name))) {
              const variableName: string = getNodeName(name);
              constants[variableName] = getSkittlesExpression(
                initializer,
                interfaces,
                constants
              );
            }
          });
        }
      });
    }

    // Handling if it's a global constant
    if (isVariableStatement(child)) {
      const { declarations } = child.declarationList;
      declarations.forEach((declaration) => {
        const { name, initializer } = declaration;
        if (initializer) {
          const variableName: string = getNodeName(name);
          constants[variableName] = getSkittlesExpression(
            initializer,
            interfaces,
            constants
          );
        }
      });
    }
  });
  return constants;
};

export default getSkittlesConstants;
