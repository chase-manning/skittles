import SkittlesClass, {
  SkittlesMethod,
  SkittlesVariable,
} from "../types/skittles-class";

import { Abi } from "../types/abi-types";
import formatYul from "./format-yul";
import { getBaseYul } from "../helpers/yul-helper";
import addStorageLayout from "./add-yul-storage-layout";
import addConstructor from "./add-yul-constructor";
import addPropertyDispatcher from "./add-yul-property-dispatcher";
import addMethodDispatcher from "./add-yul-method-dispatcher";
import addMethodFunction from "./add-yul-method-function";
import addStorageAccess from "./add-yul-storage-access";
import addValueInitializations from "./add-yul-value-initialzations";

const getYul = (skittlesClass: SkittlesClass, abi: Abi) => {
  // Getting base data
  let yul = getBaseYul(skittlesClass.name);

  // Adding properties
  skittlesClass.variables.forEach(
    (property: SkittlesVariable, index: number) => {
      yul = addPropertyDispatcher(yul, abi, property);
      yul = addStorageLayout(yul, property, index);
      yul = addStorageLayout(yul, property, index, true);
      yul = addStorageAccess(yul, property, skittlesClass);
      yul = addStorageAccess(yul, property, skittlesClass, true);
      yul = addValueInitializations(yul, property, index);
    }
  );

  // Adding constructor
  yul = addConstructor(yul, skittlesClass);

  // Adding methods
  skittlesClass.methods.forEach((method: SkittlesMethod) => {
    yul = addMethodDispatcher(yul, abi, method);
    yul = addMethodFunction(yul, method);
  });

  // Formatting
  return formatYul(yul);
};

export default getYul;
