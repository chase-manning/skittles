import { SkittlesExpression, SkittlesExpressionType } from "../types/skittles-expression";
import { SkittlesStatement, SkittlesStatementType } from "../types/skittles-statement";

interface StatementExpressionConfig {
  expressions: string[];
  expressionLists: string[];
}

const statementExpressionConfig: Record<string, StatementExpressionConfig> = {
  "Storage Update": {
    expressions: ["value"],
    expressionLists: [],
  },
  Return: {
    expressions: ["value"],
    expressionLists: [],
  },
  "Mapping Update": {
    expressions: ["value"],
    expressionLists: ["items"],
  },
  "Variable Update": {
    expressions: ["value"],
    expressionLists: [],
  },
  Call: {
    expressions: ["element"],
    expressionLists: ["parameters"],
  },
  If: {
    expressions: ["condition"],
    expressionLists: ["then", "else"],
  },
  Throw: {
    expressions: ["error"],
    expressionLists: [],
  },
  Ignore: {
    expressions: [],
    expressionLists: [],
  },
  "Variable Declaration": {
    expressions: ["value"],
    expressionLists: [],
  },
  "Emit Event": {
    expressions: [],
    expressionLists: ["values"],
  },
};

interface ExtractedData {
  variableDeclarations: SkittlesStatement[];
  extractedExpression: SkittlesExpression;
}

const extractConditionalExpressions = (expression: SkittlesExpression): ExtractedData => {
  if (expression.expressionType === SkittlesExpressionType.Conditional) {
    const conditionData = extractConditionalExpressions(expression.condition);
    const trueData = extractConditionalExpressions(expression.trueValue);
    const falseData = extractConditionalExpressions(expression.falseValue);
    const variableName = `conditionalExpression${Math.floor(Math.random() * 1000000000)}`;
    return {
      variableDeclarations: [
        ...conditionData.variableDeclarations,
        ...trueData.variableDeclarations,
        ...falseData.variableDeclarations,
        {
          statementType: SkittlesStatementType.VariableDeclaration,
          variable: variableName,
          value: falseData.extractedExpression,
        },
        {
          statementType: SkittlesStatementType.If,
          condition: conditionData.extractedExpression,
          then: [
            {
              statementType: SkittlesStatementType.VariableUpdate,
              variable: variableName,
              value: trueData.extractedExpression,
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
  config: StatementExpressionConfig
): SkittlesStatement[] => {
  const newStatements: SkittlesStatement[] = [];
  config.expressions.forEach((expression) => {
    const data = extractConditionalExpressions(statement[expression]);
    newStatements.push(...data.variableDeclarations);
    statement[expression] = data.extractedExpression;
  });
  config.expressionLists.forEach((expressionList) => {
    statement[expressionList].forEach((expression: SkittlesExpression, index: number) => {
      const data = extractConditionalExpressions(expression);
      newStatements.push(...data.variableDeclarations);
      statement[expressionList][index] = data.extractedExpression;
    });
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
  const config = statementExpressionConfig[statement.statementType];
  if (!config)
    throw new Error(`missing extract conditional expression statements config ${statement}`);
  return getNewStatements(statement, config);
};

export default extractConditionalExpressionStatements;
