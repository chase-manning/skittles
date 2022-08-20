import { ethers } from "hardhat";
import { ContractFactory } from "ethers";
import getAbi from "../src/get-abi";
import getBytecode from "../src/get-bytecode";
import getSkittlesClass from "../src/get-skittles-class";
import getYul from "../src/get-yul";
import { writeFile } from "../src/helpers/file-helper";
import fs from "fs";

const readFileAsString = (fileName: string) => {
  return fs.readFileSync(fileName, { encoding: "utf8" });
};

export const getContractFactory = async (
  file: string,
  debug: boolean = false
): Promise<ContractFactory> => {
  const skittlesClass = getSkittlesClass(file);
  const { name } = skittlesClass;
  const abi = getAbi(skittlesClass);
  writeFile("abi", name, JSON.stringify(abi, null, 2));
  const yul = debug
    ? readFileAsString(`./build/yul/${name}.yul`)
    : getYul(skittlesClass, abi, true);
  writeFile("yul", name, yul);
  const bytecode = getBytecode(skittlesClass.name, yul);
  writeFile("bytecode", name, bytecode);
  return await ethers.getContractFactory(abi, bytecode);
};
