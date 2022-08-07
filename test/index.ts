import { expect } from "chai";
import { ethers } from "hardhat";
import abi from "../data/abis/hello-world";

const bytecode =
  "60df61000e60003960df6000f3fe60056042565b63b69ef8a88114601e5763d91921ed8114602e57600080fd5b602a6026609c565b608d565b603d565b603c60386000606b565b60aa565b5b5060de565b60007c010000000000000000000000000000000000000000000000000000000060003504905090565b60006020820260040160208101361015608357600080fd5b8035915050919050565b8060005260206000f35b600090565b600060a46097565b54905090565b60b78160b3609c565b60c1565b60bd6097565b5550565b60008282019050828110828210171560d857600080fd5b92915050565b";

describe("Hello World", function () {
  it("Should deploy contract", async () => {
    const HelloWorld = await ethers.getContractFactory(abi, bytecode);
    const helloWorld = await HelloWorld.deploy();
    await helloWorld.deployed();

    expect(await helloWorld.balance()).to.equal(0);

    await helloWorld.addBalance(1);

    expect(await helloWorld.balance()).to.equal(1);
  });
});
