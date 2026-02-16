import { Expression } from "typescript";
import { SkittlesConstants, SkittlesInterfaces } from "../types/skittles-contract";
import { SkittlesExpression } from "../types/skittles-expression";
declare const getSkittlesExpression: (expression: Expression, interfaces: SkittlesInterfaces, constants: SkittlesConstants) => SkittlesExpression;
export default getSkittlesExpression;
