import {
  isMethodDeclaration,
  isPropertyDeclaration,
  isConstructorDeclaration,
} from "typescript";
import getAst from "../ast/get-ast";
import {
  getClassNodes,
  getNodeName,
  isPropertyArrowFunction,
  isVariable,
} from "../helpers/ast-helper";
import SkittlesContract from "../types/skittles-contract";
import getSkittlesConstants from "./get-skittles-constants";
import getSkittlesConstructor from "./get-skittles-constructor";
import getSkittlesInterfaces from "./get-skittles-interfaces";
import getSkittlesMethod from "./get-skittles-method";
import getSkittlesProperty from "./get-skittles-property";
import getStateMutability from "./get-skittles-state-mutability";

const getSkittlesContracts = (file: string): SkittlesContract[] => {
  const ast = getAst(file);
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

    const contract: SkittlesContract = {
      classExtensions,
      constants,
      interfaces,
      name: getNodeName(classNode),
      constructor: astConstructor
        ? getSkittlesConstructor(astConstructor, interfaces, constants)
        : undefined,
      variables: astVariables.map((v) =>
        getSkittlesProperty(v, interfaces, constants)
      ),
      methods: [
        ...astMethods.map((m) => getSkittlesMethod(m, interfaces, constants)),
        ...astArrowFunctions.map((f) =>
          getSkittlesMethod(f, interfaces, constants)
        ),
      ],
    };

    return getStateMutability(contract);
  });
};

export default getSkittlesContracts;
