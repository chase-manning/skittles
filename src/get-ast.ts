import {
  createProgram,
  ModuleKind,
  ScriptTarget,
  SourceFile,
} from "typescript";

const getAst = (file: string): SourceFile => {
  let program = createProgram([file], {
    allowJs: true,
    target: ScriptTarget.ES5,
    module: ModuleKind.CommonJS,
  });

  const ast = program.getSourceFile(file);
  if (!ast) throw new Error("Could not get AST");
  return ast;
};

export default getAst;
