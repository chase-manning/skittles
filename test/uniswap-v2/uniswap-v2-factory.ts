import chai, { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import getSkittlesFactory from "../../src/testing/get-skittles-factory";
import { solidity } from "ethereum-waffle";
import { ZERO_ADDRESS } from "../utils/constants";

const TEST_ADDRESSES: [string, string] = [
  "0x1000000000000000000000000000000000000000",
  "0x2000000000000000000000000000000000000000",
];

chai.use(solidity);

describe("Uniswap V2 Factory", () => {
  let factory: Contract;
  let wallet: SignerWithAddress;
  let other: SignerWithAddress;

  beforeEach(async () => {
    let signers = await ethers.getSigners();
    wallet = signers[0];
    other = signers[1];

    const Factory = await getSkittlesFactory(wallet, "UniswapV2Factory");
    factory = await Factory.deploy(wallet.address);
    await factory.deployed();
  });

  it("feeTo, feeToSetter, allPairsLength", async () => {
    expect(await factory.feeTo()).to.eq(ZERO_ADDRESS);
    expect(await factory.feeToSetter()).to.eq(wallet.address);
    // expect(await factory.allPairsLength()).to.eq(0);
  });
});
