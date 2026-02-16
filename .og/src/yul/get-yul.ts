import SkittlesContract, { SkittlesMethod, SkittlesVariable } from "../types/skittles-contract";

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
import addEvents from "./add-yul-events";

const getYul = (contract: SkittlesContract, abi: Abi) => {
  // Getting base data
  let yul = getBaseYul(contract.name);

  // Adding properties
  let slot = 0;
  contract.variables.forEach((property: SkittlesVariable) => {
    yul = addPropertyDispatcher(yul, abi, property);
    let r = addStorageLayout(yul, property, contract, slot);
    yul = addStorageAccess(r.yul, property, contract);
    yul = addValueInitializations(yul, property, slot);
    slot = r.slot;
  });

  // Adding constructor
  yul = addConstructor(yul, contract);

  // Adding methods
  contract.methods.forEach((method: SkittlesMethod) => {
    yul = addMethodDispatcher(yul, abi, method);
    yul = addMethodFunction(yul, method);
  });

  // Adding functions
  contract.functions.forEach((method: SkittlesMethod) => {
    yul = addMethodFunction(yul, method, true);
  });

  // Adding events
  yul = addEvents(yul, contract.events);

  // Formatting
  return formatYul(yul);
};

export default getYul;
