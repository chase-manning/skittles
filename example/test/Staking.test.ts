import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-ethers-chai-matchers";
import "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers, networkHelpers } = await hre.network.connect();

describe("Staking", function () {
  async function deployStakingFixture() {
    const vault = await ethers.deployContract("Staking");
    const [owner, alice, bob] = await ethers.getSigners();
    const addr = await vault.getAddress();
    const vaultAsAlice = await ethers.getContractAt("Staking", addr, alice);
    const vaultAsBob = await ethers.getContractAt("Staking", addr, bob);
    return { vault, vaultAsAlice, vaultAsBob, owner, alice, bob };
  }

  describe("deployment", function () {
    it("should set the deployer as owner", async function () {
      const { vault, owner } = await networkHelpers.loadFixture(deployStakingFixture);
      expect(await vault.owner()).to.equal(owner.address);
    });

    it("should start with zero total deposited", async function () {
      const { vault } = await networkHelpers.loadFixture(deployStakingFixture);
      expect(await vault.totalDeposited()).to.equal(0n);
    });

    it("should have correct fee constants", async function () {
      const { vault } = await networkHelpers.loadFixture(deployStakingFixture);
      expect(await vault.FEE_BASIS_POINTS()).to.equal(50n);
      expect(await vault.BASIS_POINTS_DENOMINATOR()).to.equal(10000n);
    });
  });

  describe("deposits", function () {
    it("should accept ETH deposits via the deposit function", async function () {
      const { vault, vaultAsAlice, alice } = await networkHelpers.loadFixture(deployStakingFixture);
      const depositAmount = ethers.parseEther("1");

      await vaultAsAlice.deposit({ value: depositAmount });

      expect(await vault.getDeposit(alice.address)).to.equal(depositAmount);
      expect(await vault.totalDeposited()).to.equal(depositAmount);
    });

    it("should emit a Deposited event", async function () {
      const { vault, vaultAsBob } = await networkHelpers.loadFixture(deployStakingFixture);
      const depositAmount = ethers.parseEther("2");

      await expect(vaultAsBob.deposit({ value: depositAmount }))
        .to.emit(vault, "Deposited");
    });

    it("should revert when deposit amount is zero", async function () {
      const { vaultAsAlice } = await networkHelpers.loadFixture(deployStakingFixture);

      await expect(
        vaultAsAlice.deposit({ value: 0 })
      ).to.be.revertedWith("Must send ETH");
    });
  });

  describe("withdrawals", function () {
    it("should allow withdrawal with fee deducted", async function () {
      const { vault, vaultAsAlice, alice } = await networkHelpers.loadFixture(deployStakingFixture);
      const depositAmount = ethers.parseEther("1");
      await vaultAsAlice.deposit({ value: depositAmount });

      const fee = depositAmount * 50n / 10000n;
      const expectedPayout = depositAmount - fee;

      await expect(
        vaultAsAlice.withdraw(depositAmount)
      ).to.changeEtherBalance(alice, expectedPayout);

      expect(await vault.getDeposit(alice.address)).to.equal(0n);
    });

    it("should revert when withdrawing more than deposited", async function () {
      const { vault, vaultAsBob } = await networkHelpers.loadFixture(deployStakingFixture);
      const tooMuch = ethers.parseEther("999");

      await expect(
        vaultAsBob.withdraw(tooMuch)
      ).to.be.revertedWithCustomError(vault, "InsufficientDeposit");
    });
  });

  describe("pause and unpause", function () {
    it("should allow the owner to pause the vault", async function () {
      const { vault } = await networkHelpers.loadFixture(deployStakingFixture);
      await vault.pause();
      expect(await vault.status()).to.equal(1n);
    });

    it("should revert deposits when paused", async function () {
      const { vault, vaultAsAlice } = await networkHelpers.loadFixture(deployStakingFixture);
      await vault.pause();

      await expect(
        vaultAsAlice.deposit({ value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(vault, "VaultPaused");
    });

    it("should allow the owner to unpause the vault", async function () {
      const { vault } = await networkHelpers.loadFixture(deployStakingFixture);
      await vault.pause();
      await vault.unpause();
      expect(await vault.status()).to.equal(0n);
    });

    it("should revert when non owner tries to pause", async function () {
      const { vault, vaultAsAlice } = await networkHelpers.loadFixture(deployStakingFixture);

      await expect(
        vaultAsAlice.pause()
      ).to.be.revertedWithCustomError(vault, "NotOwner");
    });
  });
});
