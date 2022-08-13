import { expect } from "chai";
import { ethers } from "hardhat";
import getAbi from "../lib/get-abi";
import getFoxClass from "../lib/get-fox-class";
import getBytecode from "../lib/get-bytecode";
import getYul from "../lib/get-yul";

describe("Hello World", () => {
  it("Should add balance", async () => {
    const FILE = "./contracts/hello-world.ts";
    const foxClass = getFoxClass(FILE);
    const abi = getAbi(foxClass);
    const yul = getYul(FILE);
    const bytecode = getBytecode(foxClass.name, yul);
    const HelloWorld = await ethers.getContractFactory(abi, bytecode);
    const helloWorld = await HelloWorld.deploy();
    await helloWorld.deployed();

    expect(await helloWorld.balance()).to.equal(0);
    expect((await helloWorld.getBalanceTimesTwo()).toString()).to.equal("0");
    await helloWorld.addBalance(1);
    expect(await helloWorld.balance()).to.equal(1);
    expect((await helloWorld.getBalanceTimesTwo()).toString()).to.equal("2");
    await helloWorld.addBalance(234);
    expect(await helloWorld.balance()).to.equal(235);
    expect((await helloWorld.getBalanceTimesTwo()).toString()).to.equal("470");
  });
});
