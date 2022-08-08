import { forEachChild, isClassDeclaration, Node } from "typescript";
import getAst from "./get-ast";
import fs from "fs";
import yulTemplate from "./data/yul-template";
import { ClassDeclaration } from "@babel/types";

const getBaseYul = (name: string): string[] => {
  const base = yulTemplate;
  base.unshift(`object "${name}" {`);
  return base;
};

const getClass = (node: Node): ClassDeclaration => {
  let classNode: Node | undefined = undefined;
  // Only consider exported nodes
  forEachChild(node, (node) => {
    if (isClassDeclaration(node)) {
      classNode = node;
    }
  });
  if (!classNode) throw new Error("Could not find class");
  return classNode;
};

const writeFile = (file: string[]) => {
  fs.writeFileSync("./output.yul", file.join("\n"));
};

const getYul = (file: string) => {
  const ast = getAst(file);
  const classNode = getClass(ast);
  const contractName = (classNode as any).name.escapedText;
  const yul = getBaseYul(contractName);

  // forEachChild(ast, process);
  writeFile(yul);
};

export default getYul;
