import { ContractFactory } from "ethers";
import fs from "fs";
import { Abi } from "../types/abi-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import path from "path";

const getFileString = (fileName: string) => {
  return fs.readFileSync(fileName, { encoding: "utf8" });
};

const getSkittlesFactory = async (
  signer: SignerWithAddress,
  contract: string
): Promise<ContractFactory> => {
  const abi = JSON.parse(
    getFileString(path.join(process.cwd(), `build/abi/${contract}.abi`))
  ) as Abi;
  const bytecode = getFileString(path.join(process.cwd(), `build/bytecode/${contract}.bytecode`));
  return new ContractFactory(abi, bytecode, signer);
};

export default getSkittlesFactory;
