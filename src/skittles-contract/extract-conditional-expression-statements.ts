import {
  SkittlesExpression,
  SkittlesExpressionType,
} from "../types/skittles-expression";
import {
  SkittlesStatement,
  SkittlesStatementType,
} from "../types/skittles-statement";

interface ExtractedData {
  variableDeclarations: SkittlesStatement[];
  extractedExpression: SkittlesExpression;
}

const extractConditionalExpressions = (
  expression: SkittlesExpression
): ExtractedData => {
  if (expression.expressionType === SkittlesExpressionType.Conditional) {
    const variableName = `conditionalExpression${Math.floor(
      Math.random() * 1000000000
    )}`;
    return {
      variableDeclarations: [
        {
          statementType: SkittlesStatementType.VariableDeclaration,
          variable: variableName,
          value: expression.falseValue,
        },
        {
          statementType: SkittlesStatementType.If,
          condition: expression.condition,
          then: [
            {
              statementType: SkittlesStatementType.VariableUpdate,
              variable: variableName,
              value: expression.trueValue,
            },
          ],
          else: [],
        },
      ],
      extractedExpression: {
        expressionType: SkittlesExpressionType.Variable,
        value: variableName,
      },
    };
  }

  return {
    variableDeclarations: [],
    extractedExpression: expression,
  };
};

const getNewStatements = (
  statement: any,
  expressions: string[],
  expressionLists: string[] = []
): SkittlesStatement[] => {
  const newStatements: SkittlesStatement[] = [];
  expressions.forEach((expression) => {
    const data = extractConditionalExpressions(statement[expression]);
    newStatements.push(...data.variableDeclarations);
    statement[expression] = data.extractedExpression;
  });
  expressionLists.forEach((expressionList) => {
    statement[expressionList].forEach(
      (expression: SkittlesExpression, index: number) => {
        const data = extractConditionalExpressions(expression);
        newStatements.push(...data.variableDeclarations);
        statement[expressionList][index] = data.extractedExpression;
      }
    );
  });
  newStatements.push(statement);
  return newStatements;
};

/**
 * It is difficult to convert Conditional Expression expressions to Yul.
 * So instead this function removes all of the conditional expressions.
 * Instead it creates a new variable for each conditional expression.
 * And converts the conditional expression to a variable expression.
 * Hopfully there is an easier way to do this, but this is the best I can think of right now.
 * @param statements The list of statements to extract from
 * @returns A new list of statements, where the conditional expressions have been extracted
 */
const extractConditionalExpressionStatements = (
  statement: SkittlesStatement
): SkittlesStatement[] => {
  switch (statement.statementType) {
    case SkittlesStatementType.StorageUpdate:
      return getNewStatements(statement, ["value"]);
    case SkittlesStatementType.Return:
      return getNewStatements(statement, ["value"]);
    case SkittlesStatementType.VariableUpdate:
      return getNewStatements(statement, ["value"]);
    case SkittlesStatementType.MappingUpdate:
      return getNewStatements(statement, ["value"], ["items"]);
    case SkittlesStatementType.Call:
      return getNewStatements(statement, ["element"], ["parameters"]);
    case SkittlesStatementType.If:
      return getNewStatements(statement, ["condition"], ["then", "else"]);
    case SkittlesStatementType.Throw:
      return getNewStatements(statement, ["error"]);
    case SkittlesStatementType.Ignore:
      return [statement];
    case SkittlesStatementType.VariableDeclaration:
      return getNewStatements(statement, ["value"]);
    default:
      throw new Error(`Unsupported statement extraction type ${statement}`);
  }
};

export default extractConditionalExpressionStatements;
