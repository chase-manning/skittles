import {
  isMethodDeclaration,
  isPropertyDeclaration,
  isConstructorDeclaration,
} from "typescript";
import getAst from "../get-ast";
import {
  getClassNode,
  getNodeName,
  isPropertyArrowFunction,
  isVariable,
} from "../helpers/ast-helper";
import SkittlesClass from "../types/skittles-class";
import getSkittlesConstructor from "./get-skittles-constructor";
import getSkittlesMethod from "./get-skittles-method";
import getSkittlesProperty from "./get-skittles-property";
import getStateMutability from "./get-skittles-state-mutability";

const getSkittlesClass = (file: string): SkittlesClass => {
  const ast = getAst(file);
  const classNode = getClassNode(ast);

  const astVariables = classNode.members
    .filter(isPropertyDeclaration)
    .filter(isVariable);

  const astMethods = classNode.members.filter(isMethodDeclaration);

  const astArrowFunctions = classNode.members
    .filter(isPropertyDeclaration)
    .filter(isPropertyArrowFunction);

  const astConstructor = classNode.members.find(isConstructorDeclaration);

  const skittlesClass = {
    name: getNodeName(classNode),
    constructor: astConstructor
      ? getSkittlesConstructor(astConstructor)
      : undefined,
    variables: astVariables.map(getSkittlesProperty),
    methods: [
      ...astMethods.map(getSkittlesMethod),
      ...astArrowFunctions.map(getSkittlesMethod),
    ],
  };

  return getStateMutability(skittlesClass);
};

export default getSkittlesClass;
