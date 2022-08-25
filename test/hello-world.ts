import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { isAddress } from "ethers/lib/utils";
import getSkittlesFactory from "../src/testing/get-skittles-factory";

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

    const HelloWorld = await getSkittlesFactory(walletA, "HelloWorld");
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

  /* Test all these */
  // getNotEqualToTwo = (value: number): boolean => 2 !== value;
  // getEqualToSeven = (value: number): boolean => 7 === value;
  // getGreaterThanFour = (value: number): boolean => value > 4;
  // getLessThan9 = (value: number): boolean => value < 9;
  // getGreaterThanOrEqualToFour = (value: number): boolean => value >= 4;
  // getLessThanOrEqualTo9 = (value: number): boolean => value <= 9;
  // getAnd = (value: boolean): boolean => value && true;
  // getOr = (value: boolean): boolean => value || false;
  // getNot = (value: boolean): boolean => !value;

  it("Should get Not Equal To Two", async () => {
    const result = await helloWorld.getNotEqualToTwo(2);
    expect(result).to.equal(false);
    const neg_result = await helloWorld.getNotEqualToTwo(1);
    expect(neg_result).to.equal(true);
  });

  it("Should get Equal To Seven", async () => {
    const result = await helloWorld.getEqualToSeven(7);
    expect(result).to.equal(true);
    const neg_result = await helloWorld.getEqualToSeven(1);
    expect(neg_result).to.equal(false);
  });

  it("Should get Greater Than Four", async () => {
    const result = await helloWorld.getGreaterThanFour(5);
    expect(result).to.equal(true);
    const neg_result = await helloWorld.getGreaterThanFour(3);
    expect(neg_result).to.equal(false);
    const edge_result = await helloWorld.getGreaterThanFour(4);
    expect(edge_result).to.equal(false);
  });

  it("Should get Less Than 9", async () => {
    const result = await helloWorld.getLessThan9(8);
    expect(result).to.equal(true);
    const neg_result = await helloWorld.getLessThan9(10);
    expect(neg_result).to.equal(false);
    const edge_result = await helloWorld.getLessThan9(9);
    expect(edge_result).to.equal(false);
  });

  it("Should get Greater Than Or Equal To Four", async () => {
    const result = await helloWorld.getGreaterThanOrEqualToFour(5);
    expect(result).to.equal(true);
    const neg_result = await helloWorld.getGreaterThanOrEqualToFour(2);
    expect(neg_result).to.equal(false);
    const edge_result = await helloWorld.getGreaterThanOrEqualToFour(4);
    expect(edge_result).to.equal(true);
  });

  it("Should get Less Than Or Equal To 9", async () => {
    const result = await helloWorld.getLessThanOrEqualTo9(8);
    expect(result).to.equal(true);
    const neg_result = await helloWorld.getLessThanOrEqualTo9(10);
    expect(neg_result).to.equal(false);
    const edge_result = await helloWorld.getLessThanOrEqualTo9(9);
    expect(edge_result).to.equal(true);
  });

  it("Should get And", async () => {
    const result = await helloWorld.getAnd(true);
    expect(result).to.equal(true);
    const neg_result = await helloWorld.getAnd(false);
    expect(neg_result).to.equal(false);
  });

  it("Should get Or", async () => {
    const result = await helloWorld.getOr(false);
    expect(result).to.equal(false);
    const neg_result = await helloWorld.getOr(true);
    expect(neg_result).to.equal(true);
  });

  it("Should get Not", async () => {
    const result = await helloWorld.getNot(true);
    expect(result).to.equal(false);
    const neg_result = await helloWorld.getNot(false);
    expect(neg_result).to.equal(true);
  });

  it("Should get weird condition", async () => {
    const four_result = await helloWorld.getWeirdCondition(4);
    expect(four_result).to.equal(789);
    const three_result = await helloWorld.getWeirdCondition(3);
    expect(three_result).to.equal(123);
    const nine_result = await helloWorld.getWeirdCondition(9);
    expect(nine_result).to.equal(43);
  });

  it("Should update weird condition", async () => {
    await helloWorld.weirdConditionUpdate(4);
    expect(await helloWorld.balance()).to.equal(789);
    await helloWorld.weirdConditionUpdate(3);
    expect(await helloWorld.balance()).to.equal(123);
    await helloWorld.weirdConditionUpdate(9);
    expect(await helloWorld.balance()).to.equal(43);
  });

  it("Should get simple if statement return", async () => {
    expect(await helloWorld.getSimpleIfStatementReturn(1)).to.equal(1);
    expect(await helloWorld.getSimpleIfStatementReturn(2)).to.equal(2);
    expect(await helloWorld.getSimpleIfStatementReturn(3)).to.equal(3);
  });

  it("Should do simple update", async () => {
    await helloWorld.simpleIfStatementUpdate(1);
    expect(await helloWorld.balance()).to.equal(1);
    await helloWorld.simpleIfStatementUpdate(2);
    expect(await helloWorld.balance()).to.equal(2);
    await helloWorld.simpleIfStatementUpdate(3);
    expect(await helloWorld.balance()).to.equal(3);
  });

  it("Should get public mapping", async () => {
    expect(await helloWorld.publicMapping(walletA.address)).to.equal(7890 * 2);
  });

  it("Should get public nested mapping", async () => {
    const { address } = walletA;
    const value = await helloWorld.publicMappingNested(address, address);
    expect(value).to.equal(7890 * 3);
  });
});
