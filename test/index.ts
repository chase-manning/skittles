import { expect } from "chai";
import { ethers } from "hardhat";
import getAbi from "../src/get-abi";
import getSkittlesClass from "../src/get-skittles-class";
import getBytecode from "../src/get-bytecode";
import getYul from "../src/get-yul";

describe("Hello World", () => {
  it("Should add balance", async () => {
    const FILE = "./contracts/hello-world.ts";
    const skittlesClass = getSkittlesClass(FILE);
    const abi = getAbi(skittlesClass);
    const yul = getYul(skittlesClass, abi);
    const bytecode = getBytecode(skittlesClass.name, yul);
    const HelloWorld = await ethers.getContractFactory(abi, bytecode);
    const helloWorld = await HelloWorld.deploy();
    await helloWorld.deployed();

    expect(await helloWorld.balance()).to.equal(1);
    expect(await helloWorld.getBalanceTimesTwo()).to.equal(2);
    await helloWorld.addBalance(1);
    expect(await helloWorld.balance()).to.equal(2);
    expect(await helloWorld.getBalanceTimesTwo()).to.equal(4);
    await helloWorld.addBalance(234);
    expect(await helloWorld.balance()).to.equal(236);
    expect(await helloWorld.getBalanceTimesTwo()).to.equal(472);
  });
});
