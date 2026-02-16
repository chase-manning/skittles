import { SkittlesStatement } from "../types/skittles-statement";
/**
 * It is difficult to convert Conditional Expression expressions to Yul.
 * So instead this function removes all of the conditional expressions.
 * Instead it creates a new variable for each conditional expression.
 * And converts the conditional expression to a variable expression.
 * Hopfully there is an easier way to do this, but this is the best I can think of right now.
 * @param statements The list of statements to extract from
 * @returns A new list of statements, where the conditional expressions have been extracted
 */
declare const extractConditionalExpressionStatements: (statements: SkittlesStatement[]) => SkittlesStatement[];
export default extractConditionalExpressionStatements;
