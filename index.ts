import getAst from "./lib/get-ast";

console.log("meow");

const ast = getAst("./contracts/hello-world.ts");
console.log(ast);
