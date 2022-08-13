import getBytecode from "./get-bytecode";
import getSkittlesClass from "./get-skittles-class";
import getYul from "./get-yul";

export const compileTypeScriptToBytecode = async (fileName: string) => {
  const skittlesClass = getSkittlesClass(fileName);
  const yul = getYul(fileName);
  return getBytecode(skittlesClass.name, yul);
};
