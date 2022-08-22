import { ethers } from "hardhat";
import { ContractFactory } from "ethers";
import getAbi, { Abi } from "../src/abi/get-abi";
import getBytecode from "../src/bytecode/get-bytecode";
import getSkittlesClass from "../src/skittles-class/get-skittles-class";
import getYul from "../src/yul/get-yul";
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
  const abi = debug
    ? (JSON.parse(readFileAsString(`./build/abi/${name}.abi`)) as Abi)
    : getAbi(skittlesClass);
  if (!debug) writeFile("abi", name, JSON.stringify(abi, null, 2));
  const yul = debug
    ? readFileAsString(`./build/yul/${name}.yul`)
    : getYul(skittlesClass, abi);
  if (!debug) writeFile("yul", name, yul);
  const bytecode = getBytecode(skittlesClass.name, yul);
  if (!debug) writeFile("bytecode", name, bytecode);
  return await ethers.getContractFactory(abi, bytecode);
};
