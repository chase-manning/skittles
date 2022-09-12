import {
  isMethodDeclaration,
  isPropertyDeclaration,
  isConstructorDeclaration,
} from "typescript";
import { getAstFromFile } from "../ast/get-ast";
import {
  getClassNodes,
  getNodeName,
  isPropertyArrowFunction,
  isVariable,
} from "../helpers/ast-helper";
import SkittlesCache from "../types/skittles-cache";
import SkittlesContract from "../types/skittles-contract";
import getSkittlesConstants from "./get-skittles-constants";
import getSkittlesConstructor from "./get-skittles-constructor";
import getSkittlesEvents from "./get-skittles-events";
import getSkittlesInterfaces from "./get-skittles-interfaces";
import getSkittlesMethod from "./get-skittles-method";
import getStateMutability from "./get-skittles-state-mutability";
import getSkittlesVariables from "./get-skittles-variables";

const getSkittlesContracts = (
  file: string,
  hash: number,
  cache: SkittlesCache,
  sourceFile: string
): SkittlesContract[] => {
  // Returning from cache if still valid
  if (cache.files && cache.files[file] && cache.files[file].hash === hash) {
    return cache.files[file].contracts;
  }

  // Gettings contracts if cache not valid
  const ast = getAstFromFile(sourceFile);
  const interfaces = getSkittlesInterfaces(ast);

  const classNodes = getClassNodes(ast);
  return classNodes.map((classNode) => {
    const astVariables = classNode.members
      .filter(isPropertyDeclaration)
      .filter(isVariable);

    const astMethods = classNode.members.filter(isMethodDeclaration);

    const astArrowFunctions = classNode.members
      .filter(isPropertyDeclaration)
      .filter(isPropertyArrowFunction);

    const astConstructor = classNode.members.find(isConstructorDeclaration);

    const classExtensions: string[] = [];
    const { heritageClauses } = classNode;
    if (heritageClauses) {
      heritageClauses.forEach((heritageClause) => {
        heritageClause.types.forEach((type) => {
          classExtensions.push(getNodeName(type.expression));
        });
      });
    }

    const constants = getSkittlesConstants(ast, interfaces, file);

    const events = getSkittlesEvents(astVariables, interfaces);

    const variables = getSkittlesVariables(astVariables, interfaces, constants);

    const contract: SkittlesContract = {
      classExtensions,
      constants,
      interfaces,
      events,
      name: getNodeName(classNode),
      constructor: astConstructor
        ? getSkittlesConstructor(astConstructor, interfaces, constants, events)
        : undefined,
      variables,
      methods: [
        ...astMethods.map((m) =>
          getSkittlesMethod(m, interfaces, constants, events)
        ),
        ...astArrowFunctions.map((f) =>
          getSkittlesMethod(f, interfaces, constants, events)
        ),
      ],
    };

    return getStateMutability(contract);
  });
};

export default getSkittlesContracts;
