import { expect } from "chai";
import { ethers } from "hardhat";
import getAbi from "../src/get-abi";
import getSkittlesClass from "../src/get-skittles-class";
import getBytecode from "../src/get-bytecode";
import getYul from "../src/get-yul";
import { Contract } from "ethers";
import fs from "fs";

let token: Contract;
let walletA: any;
let walletB: any;
let walletC: any;

const readFileAsString = (fileName: string) => {
  return fs.readFileSync(fileName, { encoding: "utf8" });
};

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
    // const yul = readFileAsString("./build/yul/erc20.yul");
    const bytecode = getBytecode(skittlesClass.name, yul);
    const Token = await ethers.getContractFactory(abi, bytecode);
    token = await Token.deploy(18);
    await token.deployed();
  });

  it("Should have 0 total supply to start", async () => {
    const totalSupply = await token.totalSupply();
    expect(totalSupply).to.equal(0);
  });

  it("Should have 18 decimals", async () => {
    expect(await token.decimals()).to.equal(18);
  });

  it("Should have owner", async () => {
    expect(await token.owner()).to.equal(
      "0x00000000006c3852cbEf3e08E8dF289169EdE581"
    );
  });

  it("owner should have 100 balance by default", async () => {
    const owner = await token.owner();
    const ownerBalance = await token.balanceOf(owner);
    expect(ownerBalance).to.equal(100);
  });

  it("B should have 0 balance by default", async () => {
    const bBalance = await token.balanceOf(walletB.address);
    expect(bBalance).to.equal(0);
  });

  it("owner should transfer to B", async () => {
    const amount = 10;
    const tx = await token.transfer(walletB.address, amount);
    expect(tx.hash).to.be.a("string");
    const bBalance = await token.balanceOf(walletB.address);
    expect(bBalance).to.equal(amount);
  });
});
