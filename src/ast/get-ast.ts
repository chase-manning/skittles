import { readFileSync } from "fs";
import ts, { ScriptTarget, SourceFile } from "typescript";

export const getAstFromFileName = (file: string): SourceFile => {
  const fileString = readFileSync(file, "utf8");
  return getAstFromFile(fileString);
};

export const getAstFromFile = (file: string): SourceFile => {
  const ast = ts.createSourceFile("x.ts", file, ScriptTarget.ES5);
  if (!ast) throw new Error("Could not get AST");
  return ast;
};
