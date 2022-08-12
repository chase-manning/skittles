import { expect } from "chai";
import { ethers } from "hardhat";
import getAbi from "../lib/get-abi";
import getFoxClass from "../lib/get-fox-class";
import getBytecode from "../lib/get-bytecode";

describe("Hello World", function () {
  it("Should add balance", async () => {
    const bytecode = await getBytecode("./output.yul");
    const foxClass = getFoxClass("./contracts/hello-world.ts");
    const abi = getAbi(foxClass);
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
