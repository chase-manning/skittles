import { expect } from "chai";
import { ethers } from "hardhat";
import getAbi from "../lib/get-abi";
import fs from "fs";

const getBytecode = () => {
  const file = fs.readFileSync("./Binary.bin", "utf8");
  const lines = file.split("\n");
  return lines[4];
};

describe("Hello World", function () {
  it("Should add balance", async () => {
    const bytecode = getBytecode();
    const abi = getAbi("./contracts/hello-world.ts");
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
