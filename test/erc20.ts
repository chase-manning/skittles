import { expect } from "chai";
import { ethers } from "hardhat";
import getAbi from "../src/get-abi";
import getSkittlesClass from "../src/get-skittles-class";
import getBytecode from "../src/get-bytecode";
import getYul from "../src/get-yul";
import { Contract } from "ethers";

let token: Contract;
let walletA;
let walletB;
let walletC;

describe("ERC20", () => {
  before(async () => {
    let signers = await ethers.getSigners();
    walletA = signers[0];
    walletB = signers[1];
    walletC = signers[2];

    const FILE = "./contracts/erc20.ts";
    const skittlesClass = getSkittlesClass(FILE);
    const abi = getAbi(skittlesClass);
    const yul = getYul(skittlesClass, abi, true);
    const bytecode = getBytecode(skittlesClass.name, yul);
    const Token = await ethers.getContractFactory(abi, bytecode);
    token = await Token.deploy();
    await token.deployed();
  });

  it("Should have 0 total supply to start", async () => {
    const totalSupply = await token.totalSupply();
    expect(totalSupply).to.equal(0);
  });
});
