import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { isAddress } from "ethers/lib/utils";
import getSkittlesFactory from "../src/testing/get-skittles-factory";
import { address } from "../src/types/core-types";
import { ZERO_ADDRESS } from "../src/data/constants";

let regressionTest: Contract;
let walletA: any;
let walletB: any;
let walletC: any;

describe("Regression Test", () => {
  before(async () => {
    let signers = await ethers.getSigners();
    walletA = signers[0];
    walletB = signers[1];
    walletC = signers[2];

    const RegressionTest = await getSkittlesFactory(walletA, "RegressionTest");
    regressionTest = await RegressionTest.deploy(7890);
    await regressionTest.deployed();
  });

  it("Should have second contract", async () => {
    const Factory = await getSkittlesFactory(walletA, "SecondRegressionTest");
    const secondRegressionTest = await Factory.deploy();
    await secondRegressionTest.deployed();
    expect(await secondRegressionTest.variable()).to.equal(1);
  });

  it("Should not have view for _privatebalance", async () => {
    let errored = false;
    try {
      await regressionTest._privatebalance();
    } catch {
      errored = true;
    }
    expect(errored).to.equal(true);
  });

  it("Should not have view for _protectedBalance", async () => {
    let errored = false;
    try {
      await regressionTest._protectedBalance();
    } catch {
      errored = true;
    }
    expect(errored).to.equal(true);
  });

  it("Should not have view for _protectedView", async () => {
    let errored = false;
    try {
      await regressionTest._protectedView();
    } catch {
      errored = true;
    }
    expect(errored).to.equal(true);
  });

  it("Should not have view for _protectedFunction", async () => {
    let errored = false;
    try {
      await regressionTest._protectedFunction();
    } catch {
      errored = true;
    }
    expect(errored).to.equal(true);
  });

  it("Should have balance of 1 by default", async () => {
    const balance = await regressionTest.balance();
    expect(balance).to.equal(1);
  });

  it("Should have decimals of 18 by default", async () => {
    const decimals = await regressionTest.decimals();
    expect(decimals).to.equal(18);
  });

  it("Should have age of 46 by default", async () => {
    const age = await regressionTest.age();
    expect(age).to.equal(46);
  });

  it("Should have name of Regression Test by default", async () => {
    const name = await regressionTest.name();
    expect(name).to.equal("Regression Test");
  });

  it("Should have init of 7890 by default", async () => {
    const init = await regressionTest.init();
    expect(init).to.equal(7890);
  });

  it("Should not have view for _balances", async () => {
    let errored = false;
    try {
      await regressionTest._balances();
    } catch {
      errored = true;
    }
    expect(errored).to.equal(true);
  });

  it("Should not have view for _approvals", async () => {
    let errored = false;
    try {
      await regressionTest._approvals();
    } catch {
      errored = true;
    }
    expect(errored).to.equal(true);
  });

  it("Should have balance of 7890 for A by default", async () => {
    const balance = await regressionTest.getUsersBalance(walletA.address);
    expect(balance).to.equal(7890);
  });

  it("Should add 7 to balance", async () => {
    await regressionTest.addBalance(7);
    const balance = await regressionTest.balance();
    expect(balance).to.equal(8);
  });

  it("Should get balance times 2", async () => {
    const balance = await regressionTest.getBalanceTimesTwo();
    expect(balance).to.equal(16);
  });

  it("Should get private balance", async () => {
    const balance = await regressionTest.getPrivateBalance();
    expect(balance).to.equal(111);
  });

  it("Should not have view for _addBalance", async () => {
    let errored = false;
    try {
      await regressionTest._addBalance();
    } catch {
      errored = true;
    }
    expect(errored).to.equal(true);
  });

  it("Should set approval", async () => {
    await regressionTest.setApproval(walletB.address, 7);
    const approval = await regressionTest.getApproval(
      walletA.address,
      walletB.address
    );
    expect(approval).to.equal(7);
  });

  it("Should get Coinbase", async () => {
    const coinbase = await regressionTest.getCoinbase();
    expect(isAddress(coinbase)).to.equal(true);
    expect(coinbase).to.not.equal(ethers.constants.AddressZero);
  });

  it("Should get TX Origin", async () => {
    const txOrigin = await regressionTest.getTxOrigin();
    expect(txOrigin).to.equal(walletA.address);
  });

  it("Should get Difficulty", async () => {
    const difficulty = Number(
      (await regressionTest.getDifficulty()).toString()
    );
    expect(difficulty).to.be.greaterThan(10_000);
    expect(difficulty).to.be.lessThan(1_000_000);
  });

  it("Should get Block", async () => {
    const block = Number((await regressionTest.getBlock()).toString());
    expect(block).to.be.greaterThan(5);
    expect(block).to.be.lessThan(100);
  });

  it("Should get Timestamp", async () => {
    const timestamp = Number((await regressionTest.getTimestamp()).toString());
    const now = new Date().getTime() / 1000;
    expect(timestamp).to.be.greaterThan(now * 0.9);
    expect(timestamp).to.be.lessThan(now * 1.1);
  });

  it("Should get Chain ID", async () => {
    const chainId = await regressionTest.getChainId();
    expect(chainId).to.equal(31337);
  });

  it("Should get MSG Value", async () => {
    expect(await regressionTest.getMsgValue()).to.equal(0);
  });

  it("Should get TX Gas Price", async () => {
    const txGasPrice = await regressionTest.getTxGasPrice();
    expect(txGasPrice).to.equal(0);
  });

  it("Should get Maths Result", async () => {
    const result = Number((await regressionTest.getMathsResult()).toString());
    expect(result).to.equal(1);
  });

  it("Should get Not Equal To Two", async () => {
    const result = await regressionTest.getNotEqualToTwo(2);
    expect(result).to.equal(false);
    const neg_result = await regressionTest.getNotEqualToTwo(1);
    expect(neg_result).to.equal(true);
  });

  it("Should get Equal To Seven", async () => {
    const result = await regressionTest.getEqualToSeven(7);
    expect(result).to.equal(true);
    const neg_result = await regressionTest.getEqualToSeven(1);
    expect(neg_result).to.equal(false);
  });

  it("Should get Greater Than Four", async () => {
    const result = await regressionTest.getGreaterThanFour(5);
    expect(result).to.equal(true);
    const neg_result = await regressionTest.getGreaterThanFour(3);
    expect(neg_result).to.equal(false);
    const edge_result = await regressionTest.getGreaterThanFour(4);
    expect(edge_result).to.equal(false);
  });

  it("Should get Less Than 9", async () => {
    const result = await regressionTest.getLessThan9(8);
    expect(result).to.equal(true);
    const neg_result = await regressionTest.getLessThan9(10);
    expect(neg_result).to.equal(false);
    const edge_result = await regressionTest.getLessThan9(9);
    expect(edge_result).to.equal(false);
  });

  it("Should get Greater Than Or Equal To Four", async () => {
    const result = await regressionTest.getGreaterThanOrEqualToFour(5);
    expect(result).to.equal(true);
    const neg_result = await regressionTest.getGreaterThanOrEqualToFour(2);
    expect(neg_result).to.equal(false);
    const edge_result = await regressionTest.getGreaterThanOrEqualToFour(4);
    expect(edge_result).to.equal(true);
  });

  it("Should get Less Than Or Equal To 9", async () => {
    const result = await regressionTest.getLessThanOrEqualTo9(8);
    expect(result).to.equal(true);
    const neg_result = await regressionTest.getLessThanOrEqualTo9(10);
    expect(neg_result).to.equal(false);
    const edge_result = await regressionTest.getLessThanOrEqualTo9(9);
    expect(edge_result).to.equal(true);
  });

  it("Should get And", async () => {
    const result = await regressionTest.getAnd(true);
    expect(result).to.equal(true);
    const neg_result = await regressionTest.getAnd(false);
    expect(neg_result).to.equal(false);
  });

  it("Should get Or", async () => {
    const result = await regressionTest.getOr(false);
    expect(result).to.equal(false);
    const neg_result = await regressionTest.getOr(true);
    expect(neg_result).to.equal(true);
  });

  it("Should get Not", async () => {
    const result = await regressionTest.getNot(true);
    expect(result).to.equal(false);
    const neg_result = await regressionTest.getNot(false);
    expect(neg_result).to.equal(true);
  });

  it("Should get weird condition", async () => {
    const four_result = await regressionTest.getWeirdCondition(4);
    expect(four_result).to.equal(789);
    const three_result = await regressionTest.getWeirdCondition(3);
    expect(three_result).to.equal(123);
    const nine_result = await regressionTest.getWeirdCondition(9);
    expect(nine_result).to.equal(43);
  });

  it("Should update weird condition", async () => {
    await regressionTest.weirdConditionUpdate(4);
    expect(await regressionTest.balance()).to.equal(789);
    await regressionTest.weirdConditionUpdate(3);
    expect(await regressionTest.balance()).to.equal(123);
    await regressionTest.weirdConditionUpdate(9);
    expect(await regressionTest.balance()).to.equal(43);
  });

  it("Should get simple if statement return", async () => {
    expect(await regressionTest.getSimpleIfStatementReturn(1)).to.equal(1);
    expect(await regressionTest.getSimpleIfStatementReturn(2)).to.equal(2);
    expect(await regressionTest.getSimpleIfStatementReturn(3)).to.equal(3);
  });

  it("Should do simple update", async () => {
    await regressionTest.simpleIfStatementUpdate(1);
    expect(await regressionTest.balance()).to.equal(1);
    await regressionTest.simpleIfStatementUpdate(2);
    expect(await regressionTest.balance()).to.equal(2);
    await regressionTest.simpleIfStatementUpdate(3);
    expect(await regressionTest.balance()).to.equal(3);
  });

  it("Should get public mapping", async () => {
    expect(await regressionTest.publicMapping(walletA.address)).to.equal(
      7890 * 2
    );
  });

  it("Should get public nested mapping", async () => {
    const { address } = walletA;
    const value = await regressionTest.publicMappingNested(address, address);
    expect(value).to.equal(7890 * 3);
  });

  it("Should get number and address type", async () => {
    const response = await regressionTest.getNumberAndAddress();
    expect(response[0]).to.equal(123);
    expect(response[1]).to.equal("0x1234567890123456789012345678901234567890");
  });

  it("Should get number and address as interface", async () => {
    interface NumberAndAddress {
      number: number;
      address: address;
    }
    const response: NumberAndAddress =
      await regressionTest.getNumberAndAddress();
    expect(response.number).to.equal(123);
    expect(response.address).to.equal(
      "0x1234567890123456789012345678901234567890"
    );
  });

  it("Should error getting address from empty array", async () => {
    let errored = false;
    try {
      await regressionTest.addressArray(0);
    } catch {
      errored = true;
    }
    expect(errored).to.equal(true);
  });

  it("Should return address array length of 0 for empty array", async () => {
    expect(await regressionTest.getAddressArrayLength()).to.equal(0);
  });

  it("Should push item to address array", async () => {
    await regressionTest.pushAddressArrayValue(walletA.address);
    expect(await regressionTest.getAddressArrayLength()).to.equal(1);
    expect(await regressionTest.addressArray(0)).to.equal(walletA.address);
  });

  it("Should declare variable", async () => {
    expect(await regressionTest.declareVariable()).to.equal(15);
  });

  it("Should update variable", async () => {
    expect(await regressionTest.variableUpdates()).to.equal(14);
  });

  it("Should get zero address from import", async () => {
    expect(await regressionTest.getZeroAddressFromImport()).to.equal(
      ZERO_ADDRESS
    );
  });

  it("Should get other address from constant", async () => {
    expect(await regressionTest.getOtherAddresFromConstant()).to.equal(
      "0x106EebF11F34ECCcaD59c1CA9398d828765f64f8"
    );
  });

  it("Should get zero address with one line", async () => {
    expect(await regressionTest.getZeroAddressWithOneLine()).to.equal(
      ZERO_ADDRESS
    );
  });
});
