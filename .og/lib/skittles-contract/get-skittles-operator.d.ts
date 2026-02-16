import { SyntaxKind } from "typescript";
import { SkittlesOperator } from "../types/skittles-expression";
declare const getSkittlesOperator: (syntaxKind: SyntaxKind) => SkittlesOperator;
export default getSkittlesOperator;
