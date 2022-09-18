import {
  isMethodDeclaration,
  isPropertyDeclaration,
  isConstructorDeclaration,
  SourceFile,
  isHeritageClause,
} from "typescript";
import {
  getClassNodes,
  getNodeName,
  isPropertyArrowFunction,
  isVariable,
} from "../helpers/ast-helper";
import SkittlesContract, {
  SkittlesConstants,
  SkittlesInterfaces,
} from "../types/skittles-contract";
import getSkittlesConstructor from "./get-skittles-constructor";
import getSkittlesEvents from "./get-skittles-events";
import getSkittlesMethod from "./get-skittles-method";
import getStateMutability from "./get-skittles-state-mutability";
import getSkittlesVariables from "./get-skittles-variables";

const getSkittlesContracts = (
  ast: SourceFile,
  interfaces: SkittlesInterfaces,
  constants: SkittlesConstants
): SkittlesContract[] => {
  const classNodes = getClassNodes(ast);
  return classNodes.map((classNode) => {
    const astVariables = classNode.members.filter(isPropertyDeclaration).filter(isVariable);

    const astMethods = classNode.members.filter(isMethodDeclaration);

    const astArrowFunctions = classNode.members
      .filter(isPropertyDeclaration)
      .filter(isPropertyArrowFunction);

    const astConstructor = classNode.members.find(isConstructorDeclaration);

    const extensions: string[] = [];
    const { heritageClauses } = classNode;
    if (heritageClauses) {
      heritageClauses.forEach((heritageClause) => {
        heritageClause.types.forEach((type) => {
          extensions.push(getNodeName(type.expression));
        });
      });
    }

    const events = getSkittlesEvents(astVariables, interfaces);

    const variables = getSkittlesVariables(astVariables, interfaces, constants);

    const contract: SkittlesContract = {
      extensions,
      constants,
      interfaces,
      events,
      name: getNodeName(classNode),
      constructor: astConstructor
        ? getSkittlesConstructor(astConstructor, interfaces, constants, events)
        : undefined,
      variables,
      methods: [
        ...astMethods.map((m) => getSkittlesMethod(m, interfaces, constants, events)),
        ...astArrowFunctions.map((f) => getSkittlesMethod(f, interfaces, constants, events)),
      ],
    };

    return getStateMutability(contract);
  });
};

export default getSkittlesContracts;
