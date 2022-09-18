import chai, { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import getSkittlesFactory from "../../src/testing/get-skittles-factory";
import { solidity } from "ethereum-waffle";
import { scale } from "../utils/number-utils";
import { MAX_UINT256 } from "../utils/constants";

chai.use(solidity);

const TOTAL_SUPPLY = scale(10000);
const TEST_AMOUNT = scale(10);

describe("Uniswap V2 ERC20", () => {
  let token: Contract;
  let wallet: SignerWithAddress;
  let other: SignerWithAddress;

  beforeEach(async () => {
    let signers = await ethers.getSigners();
    wallet = signers[0];
    other = signers[1];

    const Token = await getSkittlesFactory(wallet, "UniswapV2TestERC20");
    token = await Token.deploy(TOTAL_SUPPLY);
    await token.deployed();
  });

  it("name, symbol, decimals, totalSupply, balanceOf, DOMAIN_SEPARATOR, PERMIT_TYPEHASH", async () => {
    const name = await token.name();
    expect(name).to.eq("Uniswap V2");
    expect(await token.symbol()).to.eq("UNI-V2");
    expect(await token.decimals()).to.eq(18);
    expect(await token.balanceOf(other.address)).to.eq(0);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY);
    expect(await token.balanceOf(other.address)).to.eq(0);
  });

  it("approve", async () => {
    await expect(token.approve(other.address, TEST_AMOUNT))
      .to.emit(token, "Approval")
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT);
  });

  it("transfer", async () => {
    await expect(token.transfer(other.address, TEST_AMOUNT))
      .to.emit(token, "Transfer")
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT));
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT);
  });

  it("transfer:fail", async () => {
    await expect(token.transfer(other.address, TOTAL_SUPPLY.add(1))).to.be.reverted; // ds-math-sub-underflow
    await expect(token.connect(other).transfer(wallet.address, 1)).to.be.reverted; // ds-math-sub-underflow
  });

  it("transferFrom", async () => {
    await token.approve(other.address, TEST_AMOUNT);
    await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, "Transfer")
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.eq(0);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT));
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT);
  });

  it("transferFrom:max", async () => {
    await token.approve(other.address, MAX_UINT256);
    await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, "Transfer")
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.eq(MAX_UINT256);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT));
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT); //
  });
});
