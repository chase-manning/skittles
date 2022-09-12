import chai, { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import getSkittlesFactory from "../../src/testing/get-skittles-factory";

chai.use(solidity);

const WALLET_A_AMOUNT = 100;

let token: Contract;
let walletA: SignerWithAddress;
let walletB: SignerWithAddress;
let walletC: SignerWithAddress;

describe("ERC20", () => {
  before(async () => {
    let signers = await ethers.getSigners();
    walletA = signers[0];
    walletB = signers[1];
    walletC = signers[2];

    const Token = await getSkittlesFactory(walletA, "ERC20");
    token = await Token.deploy(100);
    await token.deployed();
  });

  it("Should have 100 total supply to start", async () => {
    const totalSupply = await token.totalSupply();
    expect(totalSupply).to.equal(100);
  });

  it("Should have Symbol as TEST", async () => {
    expect(await token.symbol()).to.equal("TEST");
  });

  it("Should have name as TEST ERC20", async () => {
    expect(await token.name()).to.equal("TEST ERC20");
  });

  it("Should have 18 decimals", async () => {
    expect(await token.decimals()).to.equal(18);
  });

  it("A should have 100 balance by default", async () => {
    expect(await token.balanceOf(walletA.address)).to.equal(WALLET_A_AMOUNT);
  });

  it("B should have 0 balance by default", async () => {
    const bBalance = await token.balanceOf(walletB.address);
    expect(bBalance).to.equal(0);
  });

  it("A should transfer to B", async () => {
    const amount = 10;
    await expect(token.transfer(walletB.address, amount))
      .to.emit(token, "transferEvent")
      .withArgs(walletA.address, walletB.address, amount);
    const bBalance = await token.balanceOf(walletB.address);
    const aBalance = await token.balanceOf(walletA.address);
    expect(bBalance).to.equal(amount);
    expect(aBalance).to.equal(WALLET_A_AMOUNT - amount);
  });

  it("A should have no allowance for B", async () => {
    const allowance = await token.allowance(walletA.address, walletB.address);
    expect(allowance).to.equal(0);
  });

  it("Should set approval for B", async () => {
    const amount = 33;
    // await expect(token.approve(walletB.address, amount);)
    //   .to.emit(token, "Transfer")
    //   .withArgs(walletA.address, walletB.address, amount);
    await token.approve(walletB.address, amount);
    const allowance = await token.allowance(walletA.address, walletB.address);
    expect(allowance).to.equal(amount);
  });

  it("Should set approval and transfer", async () => {
    const amount = 5;
    // await expect(token.connect(walletB).approve(walletA.address, amount)) THIS IS CRAP
    //   .to.emit(token, "approveEvent")
    //   .withArgs(walletB.address, walletA.address, amount);
    await token.connect(walletB).approve(walletA.address, amount);
    const bBalanceBefore = await token.balanceOf(walletB.address);
    const cBalanceBefore = await token.balanceOf(walletC.address);
    // await expect(token.connect(walletB).approve(walletA.address, amount)) THIS IS CRAP
    //   .to.emit(token, "approveEvent")
    //   .withArgs(walletB.address, walletA.address, amount);
    await token.transferFrom(walletB.address, walletC.address, amount);
    const bBalanceAfter = await token.balanceOf(walletB.address);
    expect(bBalanceAfter).to.equal(bBalanceBefore - amount);
    const cBalanceAfter = await token.balanceOf(walletC.address);
    expect(cBalanceAfter).to.equal(cBalanceBefore + amount);
  });
});
