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
  let slot = 0;
  skittlesClass.variables.forEach((property: SkittlesVariable) => {
    yul = addPropertyDispatcher(yul, abi, property);
    let r = addStorageLayout(yul, property, skittlesClass, slot);
    r = addStorageLayout(r.yul, property, skittlesClass, slot, true);
    yul = addStorageAccess(r.yul, property, skittlesClass);
    yul = addStorageAccess(yul, property, skittlesClass, true);
    yul = addValueInitializations(yul, property, slot);
    slot = r.slot;
  });

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
