import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { getContractFactory } from "./support";
import { isAddress } from "ethers/lib/utils";

let helloWorld: Contract;
let walletA: any;
let walletB: any;
let walletC: any;

describe("Hello World", () => {
  before(async () => {
    let signers = await ethers.getSigners();
    walletA = signers[0];
    walletB = signers[1];
    walletC = signers[2];

    const HelloWorld = await getContractFactory("./contracts/hello-world.ts");
    helloWorld = await HelloWorld.deploy(7890);
    await helloWorld.deployed();
  });

  it("Should not have view for _privatebalance", async () => {
    let errored = false;
    try {
      await helloWorld._privatebalance();
    } catch {
      errored = true;
    }
    expect(errored).to.equal(true);
  });

  it("Should have balance of 1 by default", async () => {
    const balance = await helloWorld.balance();
    expect(balance).to.equal(1);
  });

  it("Should have decimals of 18 by default", async () => {
    const decimals = await helloWorld.decimals();
    expect(decimals).to.equal(18);
  });

  it("Should have age of 46 by default", async () => {
    const age = await helloWorld.age();
    expect(age).to.equal(46);
  });

  it("Should have name of Hello World by default", async () => {
    const name = await helloWorld.name();
    expect(name).to.equal("Hello World");
  });

  it("Should have init of 7890 by default", async () => {
    const init = await helloWorld.init();
    expect(init).to.equal(7890);
  });

  it("Should not have view for _balances", async () => {
    let errored = false;
    try {
      await helloWorld._balances();
    } catch {
      errored = true;
    }
    expect(errored).to.equal(true);
  });

  it("Should not have view for _approvals", async () => {
    let errored = false;
    try {
      await helloWorld._approvals();
    } catch {
      errored = true;
    }
    expect(errored).to.equal(true);
  });

  it("Should have balance of 7890 for A by default", async () => {
    const balance = await helloWorld.getUsersBalance(walletA.address);
    expect(balance).to.equal(7890);
  });

  it("Should add 7 to balance", async () => {
    await helloWorld.addBalance(7);
    const balance = await helloWorld.balance();
    expect(balance).to.equal(8);
  });

  it("Should get balance times 2", async () => {
    const balance = await helloWorld.getBalanceTimesTwo();
    expect(balance).to.equal(16);
  });

  it("Should get private balance", async () => {
    const balance = await helloWorld.getPrivateBalance();
    expect(balance).to.equal(111);
  });

  it("Should not have view for _addBalance", async () => {
    let errored = false;
    try {
      await helloWorld._addBalance();
    } catch {
      errored = true;
    }
    expect(errored).to.equal(true);
  });

  it("Should set approval", async () => {
    await helloWorld.setApproval(walletB.address, 7);
    const approval = await helloWorld.getApproval(
      walletA.address,
      walletB.address
    );
    expect(approval).to.equal(7);
  });

  it("Should get Coinbase", async () => {
    const coinbase = await helloWorld.getCoinbase();
    expect(isAddress(coinbase)).to.equal(true);
    expect(coinbase).to.not.equal(ethers.constants.AddressZero);
  });

  it("Should get TX Origin", async () => {
    const txOrigin = await helloWorld.getTxOrigin();
    expect(txOrigin).to.equal(walletA.address);
  });

  it("Should get Difficulty", async () => {
    const difficulty = Number((await helloWorld.getDifficulty()).toString());
    expect(difficulty).to.be.greaterThan(10_000);
    expect(difficulty).to.be.lessThan(1_000_000);
  });

  it("Should get Block", async () => {
    const block = Number((await helloWorld.getBlock()).toString());
    expect(block).to.be.greaterThan(5);
    expect(block).to.be.lessThan(100);
  });

  it("Should get Timestamp", async () => {
    const timestamp = Number((await helloWorld.getTimestamp()).toString());
    const now = new Date().getTime() / 1000;
    expect(timestamp).to.be.greaterThan(now * 0.9);
    expect(timestamp).to.be.lessThan(now * 1.1);
  });

  it("Should get Chain ID", async () => {
    const chainId = await helloWorld.getChainId();
    expect(chainId).to.equal(31337);
  });

  it("Should get MSG Value", async () => {
    expect(await helloWorld.getMsgValue()).to.equal(0);
  });

  it("Should get TX Gas Price", async () => {
    const txGasPrice = await helloWorld.getTxGasPrice();
    expect(txGasPrice).to.equal(0);
  });

  it("Should get Maths Result", async () => {
    const result = Number((await helloWorld.getMathsResult()).toString());
    expect(result).to.equal(1);
  });
});
