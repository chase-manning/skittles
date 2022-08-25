import { SyntaxKind } from "typescript";
import { SkittlesOperator } from "../types/skittles-class";

const getSkittlesOperator = (syntaxKind: SyntaxKind): SkittlesOperator => {
  switch (syntaxKind) {
    case SyntaxKind.PlusToken:
      return SkittlesOperator.Plus;
    case SyntaxKind.MinusToken:
      return SkittlesOperator.Minus;
    case SyntaxKind.AsteriskToken:
      return SkittlesOperator.Multiply;
    case SyntaxKind.SlashToken:
      return SkittlesOperator.Divide;
    case SyntaxKind.PercentToken:
      return SkittlesOperator.Modulo;
    case SyntaxKind.AmpersandAmpersandToken:
      return SkittlesOperator.And;
    case SyntaxKind.BarBarToken:
      return SkittlesOperator.Or;
    case SyntaxKind.EqualsEqualsToken:
      return SkittlesOperator.Equals;
    case SyntaxKind.EqualsEqualsEqualsToken:
      return SkittlesOperator.Equals;
    case SyntaxKind.ExclamationEqualsToken:
      return SkittlesOperator.NotEquals;
    case SyntaxKind.ExclamationEqualsEqualsToken:
      return SkittlesOperator.NotEquals;
    case SyntaxKind.LessThanToken:
      return SkittlesOperator.LessThan;
    case SyntaxKind.LessThanEqualsToken:
      return SkittlesOperator.LessThanOrEqual;
    case SyntaxKind.GreaterThanToken:
      return SkittlesOperator.GreaterThan;
    case SyntaxKind.GreaterThanEqualsToken:
      return SkittlesOperator.GreaterThanOrEqual;
    case SyntaxKind.AsteriskAsteriskToken:
      return SkittlesOperator.Power;
    default:
      throw new Error(`Unknown syntax kind: ${syntaxKind}`);
  }
};

export default getSkittlesOperator;
