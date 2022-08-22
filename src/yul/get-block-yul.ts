import { SkittlesStatement } from "../types/skittles-class";
import getStatementYul from "./get-statement-yul";

const getBlockYul = (statements: SkittlesStatement[]): string[] => {
  const yul = [];
  for (const statement of statements) {
    yul.push(...getStatementYul(statement));
  }
  return yul;
};

export default getBlockYul;
