import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { getContractFactory } from "./support";

const WALLET_A_AMOUNT = 100;

let token: Contract;
let walletA: any;
let walletB: any;
let walletC: any;

describe("ERC20", () => {
  before(async () => {
    let signers = await ethers.getSigners();
    walletA = signers[0];
    walletB = signers[1];
    walletC = signers[2];

    const Token = await getContractFactory("./contracts/erc20.ts");
    token = await Token.deploy(18);
    await token.deployed();
  });

  it("Should have 0 total supply to start", async () => {
    const totalSupply = await token.totalSupply();
    expect(totalSupply).to.equal(0);
  });

  it("Should have 18 decimals", async () => {
    expect(await token.decimals()).to.equal(18);
  });

  it("Should have owner", async () => {
    expect(await token.owner()).to.equal(walletA.address);
  });

  it("owner should have 100 balance by default", async () => {
    const owner = await token.owner();
    const ownerBalance = await token.balanceOf(owner);
    expect(ownerBalance).to.equal(WALLET_A_AMOUNT);
  });

  it("B should have 0 balance by default", async () => {
    const bBalance = await token.balanceOf(walletB.address);
    expect(bBalance).to.equal(0);
  });

  it("owner should transfer to B", async () => {
    const amount = 10;
    const tx = await token.transfer(walletB.address, amount);
    expect(tx.hash).to.be.a("string");
    const bBalance = await token.balanceOf(walletB.address);
    const aBalance = await token.balanceOf(walletA.address);
    expect(bBalance).to.equal(amount);
    expect(aBalance).to.equal(WALLET_A_AMOUNT - amount);
  });
});
