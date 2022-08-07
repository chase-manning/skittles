import getAst from "./get-ast";

import abi from "../data/abis/hello-world";

const getAbi = (file: string): any[] => {
  const ast = getAst(file);
  return abi;
};

export default getAbi;
