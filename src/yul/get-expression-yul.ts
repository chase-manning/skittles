import {
  SkittlesBinaryExpression,
  SkittlesExpression,
  SkittlesExpressionType,
  SkittlesOperator,
} from "../types/skittles-class";
import { evmDialects } from "./yul-constants";

const getBinaryYul = (expression: SkittlesBinaryExpression): string => {
  const { left, right, operator } = expression;
  switch (operator) {
    case SkittlesOperator.Plus:
      return `safeAdd(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.Minus:
      return `safeSub(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.Multiply:
      return `mul(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.Divide:
      return `div(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.Modulo:
      return `mod(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.Equals:
      return `eq(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.NotEquals:
      return `neq(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.GreaterThan:
      return `gt(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.LessThan:
      return `lt(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.GreaterThanOrEqual:
      return `gte(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.LessThanOrEqual:
      return `lte(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.And:
      return `and(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    case SkittlesOperator.Or:
      return `or(${getExpressionYul(left)}, ${getExpressionYul(right)})`;
    default:
      throw new Error(`Unsupported binary operator ${operator}`);
  }
};

const getExpressionYul = (expression: SkittlesExpression): string => {
  switch (expression.expressionType) {
    case SkittlesExpressionType.Not:
      return `not(${getExpressionYul(expression.value)})`;
    case SkittlesExpressionType.Binary:
      return getBinaryYul(expression);
    case SkittlesExpressionType.Variable:
      return `${expression.value}Var`;
    case SkittlesExpressionType.Value:
      if (expression.type === "string") return `"${expression.value}"`;
      return expression.value;
    case SkittlesExpressionType.Storage:
      return `${expression.variable}Storage()`;
    case SkittlesExpressionType.Mapping:
      const variables = expression.items.map((item) => getExpressionYul(item));
      return `${expression.variable}Storage(${variables.join(", ")})`;
    case SkittlesExpressionType.EvmDialect:
      return evmDialects[expression.environment][expression.variable];
    default:
      throw new Error("Unsupported expression");
  }
};

export default getExpressionYul;
