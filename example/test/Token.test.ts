import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-ethers-chai-matchers";
import "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers, networkHelpers } = await hre.network.connect();
const INITIAL_SUPPLY = ethers.parseEther("1000000");

describe("Token", function () {
  async function deployTokenFixture() {
    const token = await ethers.deployContract("Token", [INITIAL_SUPPLY]);
    const [owner, alice, bob] = await ethers.getSigners();
    const addr = await token.getAddress();
    const tokenAsAlice = await ethers.getContractAt("Token", addr, alice);
    const tokenAsBob = await ethers.getContractAt("Token", addr, bob);
    return { token, tokenAsAlice, tokenAsBob, owner, alice, bob };
  }

  describe("deployment", function () {
    it("should set the token name", async function () {
      const { token } = await networkHelpers.loadFixture(deployTokenFixture);
      expect(await token.name()).to.equal("Skittles Token");
    });

    it("should set the token symbol", async function () {
      const { token } = await networkHelpers.loadFixture(deployTokenFixture);
      expect(await token.symbol()).to.equal("SKT");
    });

    it("should set 18 decimals", async function () {
      const { token } = await networkHelpers.loadFixture(deployTokenFixture);
      expect(await token.decimals()).to.equal(18n);
    });

    it("should mint the initial supply to the deployer", async function () {
      const { token, owner } = await networkHelpers.loadFixture(deployTokenFixture);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });
  });

  describe("transfer", function () {
    it("should transfer tokens between accounts", async function () {
      const { token, owner, alice } = await networkHelpers.loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("100");

      await token.transfer(alice.address, amount);

      expect(await token.balanceOf(alice.address)).to.equal(amount);
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY - amount);
    });

    it("should emit a Transfer event", async function () {
      const { token, owner, alice } = await networkHelpers.loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("50");

      await expect(token.transfer(alice.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, alice.address, amount);
    });

    it("should revert when transfer amount exceeds balance", async function () {
      const { token, tokenAsAlice, bob } = await networkHelpers.loadFixture(deployTokenFixture);
      const tooMuch = ethers.parseEther("999999999");

      await expect(
        tokenAsAlice.transfer(bob.address, tooMuch)
      ).to.be.revertedWithCustomError(token, "InsufficientBalance");
    });
  });

  describe("approve and transferFrom", function () {
    it("should set allowance", async function () {
      const { token, owner, alice } = await networkHelpers.loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("200");

      await token.approve(alice.address, amount);
      expect(await token.allowance(owner.address, alice.address)).to.equal(amount);
    });

    it("should emit an Approval event", async function () {
      const { token, owner, alice } = await networkHelpers.loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("300");

      await expect(token.approve(alice.address, amount))
        .to.emit(token, "Approval")
        .withArgs(owner.address, alice.address, amount);
    });

    it("should allow transferFrom within allowance", async function () {
      const { token, tokenAsAlice, owner, alice, bob } = await networkHelpers.loadFixture(deployTokenFixture);
      const allowance = ethers.parseEther("1000");
      await token.approve(alice.address, allowance);

      const transferAmount = ethers.parseEther("500");
      await tokenAsAlice.transferFrom(owner.address, bob.address, transferAmount);

      expect(await token.balanceOf(bob.address)).to.equal(transferAmount);
      expect(await token.allowance(owner.address, alice.address)).to.equal(
        allowance - transferAmount
      );
    });

    it("should revert transferFrom when allowance is exceeded", async function () {
      const { token, tokenAsAlice, owner, bob } = await networkHelpers.loadFixture(deployTokenFixture);
      const tooMuch = ethers.parseEther("999999999");

      await expect(
        tokenAsAlice.transferFrom(owner.address, bob.address, tooMuch)
      ).to.be.revertedWithCustomError(token, "InsufficientAllowance");
    });
  });
});
