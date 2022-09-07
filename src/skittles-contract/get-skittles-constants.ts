import {
  forEachChild,
  isImportDeclaration,
  isNamedImports,
  isVariableStatement,
  SourceFile,
} from "typescript";
import { getAstFromFileName } from "../ast/get-ast";
import { getNodeName } from "../helpers/ast-helper";
import {
  SkittlesConstants,
  SkittlesInterfaces,
} from "../types/skittles-contract";
import getSkittlesExpression from "./get-skittles-expression";

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

const addConstantsFromAst = (
  ast: SourceFile,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants,
  varNames?: string[]
): SkittlesConstants => {
  forEachChild(ast, (child) => {
    if (isVariableStatement(child)) {
      const { declarations } = child.declarationList;
      declarations.forEach((declaration) => {
        const { name, initializer } = declaration;
        if (initializer) {
          if (!varNames || varNames.includes(getNodeName(name))) {
            const variableName: string = getNodeName(name);
            constants[variableName] = getSkittlesExpression(
              initializer,
              interfaces,
              constants
            );
          }
        }
      });
    }
  });
  return constants;
};

const getSkittlesConstants = (
  ast: SourceFile,
  interfaces: SkittlesInterfaces,
  sourceFile: string
) => {
  let constants: SkittlesConstants = {};
  forEachChild(ast, (child) => {
    // Handling imports
    if (isImportDeclaration(child)) {
      const { importClause } = child;
      const module = getNodeName(child.moduleSpecifier);
      if (module === "skittles") return;
      const modifiedModule = relativePathToAbsolute(module, sourceFile);
      const childAst = getAstFromFileName(modifiedModule);
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
      constants = addConstantsFromAst(
        childAst,
        interfaces,
        constants,
        varNames
      );
    }

    // Handling if it's a global constant
    constants = addConstantsFromAst(ast, interfaces, constants);
  });
  return constants;
};

export default getSkittlesConstants;
