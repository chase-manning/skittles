import fs from "fs";
import { Abi } from "../types/abi-types";
import { ContractFactory } from "ethers";

const getFileString = (fileName: string) => {
  return fs.readFileSync(fileName, { encoding: "utf8" });
};

const getSkittlesFactory = async (
  contract: string
): Promise<ContractFactory> => {
  const abi = JSON.parse(getFileString(`./build/abi/${contract}.abi`)) as Abi;
  const bytecode = getFileString(`./build/bytecode/${contract}.bin`);
  return new ContractFactory(abi, bytecode);
};

export default getSkittlesFactory;
