import { ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
declare const getSkittlesFactory: (signer: SignerWithAddress, contract: string) => Promise<ContractFactory>;
export default getSkittlesFactory;
