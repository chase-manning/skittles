import { createProgram, ScriptTarget, SourceFile } from "typescript";

const getAst = (file: string): SourceFile | undefined => {
  let program = createProgram([file], {
    allowJs: true,
    target: ScriptTarget.JSON,
  });
  return program.getSourceFile(file);
};

export default getAst;
