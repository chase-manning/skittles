import { expect } from "chai";
import { getContractFactory } from "./support";

describe("Hello World", () => {
  it("Should add balance", async () => {
    const HelloWorld = await getContractFactory("./contracts/hello-world.ts");
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
