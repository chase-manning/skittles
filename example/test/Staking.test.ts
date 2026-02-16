import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ethers } from "ethers";
import { createTestEnv, deploy, connectAs, getBalance, TestEnv } from "./helpers";

describe("Staking", () => {
  let env: TestEnv;
  let vault: ethers.Contract;
  let owner: ethers.Signer;
  let alice: ethers.Signer;
  let bob: ethers.Signer;
  let ownerAddr: string;
  let aliceAddr: string;
  let bobAddr: string;

  beforeAll(async () => {
    env = await createTestEnv();
    owner = env.accounts[0];
    alice = env.accounts[1];
    bob = env.accounts[2];
    ownerAddr = await owner.getAddress();
    aliceAddr = await alice.getAddress();
    bobAddr = await bob.getAddress();

    vault = await deploy(env, "Staking");
  });

  afterAll(async () => {
    await env.server.close();
  });

  describe("deployment", () => {
    it("should set the deployer as owner", async () => {
      expect(await vault.owner()).toBe(ownerAddr);
    });

    it("should start with zero total deposited", async () => {
      expect(await vault.totalDeposited()).toBe(0n);
    });

    it("should have correct fee constants", async () => {
      expect(await vault.FEE_BASIS_POINTS()).toBe(50n);
      expect(await vault.BASIS_POINTS_DENOMINATOR()).toBe(10000n);
    });
  });

  describe("deposits", () => {
    it("should accept ETH deposits via the deposit function", async () => {
      const aliceVault = connectAs(vault, alice);
      const depositAmount = ethers.parseEther("1");
      await aliceVault.deposit({ value: depositAmount });

      expect(await vault.getDeposit(aliceAddr)).toBe(depositAmount);
      expect(await vault.totalDeposited()).toBe(depositAmount);
    });

    it("should emit a Deposited event", async () => {
      const bobVault = connectAs(vault, bob);
      const depositAmount = ethers.parseEther("2");
      const tx = await bobVault.deposit({ value: depositAmount });
      const receipt = await tx.wait();

      const iface = vault.interface;
      const log = receipt.logs.find(
        (l: ethers.Log) => iface.parseLog(l)?.name === "Deposited"
      );
      expect(log).toBeTruthy();
      const parsed = iface.parseLog(log!);
      expect(parsed!.args[0]).toBe(bobAddr);
      expect(parsed!.args[1]).toBe(depositAmount);
    });

    it("should accept ETH via receive (plain transfer)", async () => {
      const aliceVault = connectAs(vault, alice);
      const vaultAddr = await vault.getAddress();
      const depositAmount = ethers.parseEther("0.5");
      const depositBefore = await vault.getDeposit(aliceAddr);

      await alice.sendTransaction({ to: vaultAddr, value: depositAmount });

      const depositAfter = await vault.getDeposit(aliceAddr);
      expect(depositAfter - depositBefore).toBe(depositAmount);
    });

    it("should accumulate multiple deposits from the same account", async () => {
      const aliceVault = connectAs(vault, alice);
      const depositBefore = await vault.getDeposit(aliceAddr);
      const amount = ethers.parseEther("0.25");

      await aliceVault.deposit({ value: amount });
      await aliceVault.deposit({ value: amount });

      const depositAfter = await vault.getDeposit(aliceAddr);
      expect(depositAfter - depositBefore).toBe(amount * 2n);
    });

    it("should revert when deposit amount is zero", async () => {
      const aliceVault = connectAs(vault, alice);
      await expect(
        aliceVault.deposit({ value: 0 })
      ).rejects.toThrow();
    });
  });

  describe("withdrawals", () => {
    it("should allow withdrawal with fee deducted", async () => {
      const aliceVault = connectAs(vault, alice);
      const deposit = await vault.getDeposit(aliceAddr);
      const withdrawAmount = deposit;

      await aliceVault.withdraw(withdrawAmount);

      expect(await vault.getDeposit(aliceAddr)).toBe(0n);
    });

    it("should track accumulated fees", async () => {
      expect((await vault.totalFees()) > 0n).toBe(true);
    });

    it("should revert when withdrawing more than deposited", async () => {
      const bobVault = connectAs(vault, bob);
      const tooMuch = ethers.parseEther("999");
      await expect(bobVault.withdraw(tooMuch)).rejects.toThrow();
    });
  });

  describe("pause and unpause", () => {
    it("should allow the owner to pause the vault", async () => {
      await vault.pause();
      expect(await vault.status()).toBe(1n);
    });

    it("should revert deposits when paused", async () => {
      const aliceVault = connectAs(vault, alice);
      await expect(
        aliceVault.deposit({ value: ethers.parseEther("1") })
      ).rejects.toThrow();
    });

    it("should allow the owner to unpause the vault", async () => {
      await vault.unpause();
      expect(await vault.status()).toBe(0n);
    });

    it("should revert when non-owner tries to pause", async () => {
      const aliceVault = connectAs(vault, alice);
      await expect(aliceVault.pause()).rejects.toThrow();
    });

    it("should accept deposits again after unpause", async () => {
      const aliceVault = connectAs(vault, alice);
      const depositAmount = ethers.parseEther("0.1");
      await aliceVault.deposit({ value: depositAmount });
      expect(await vault.getDeposit(aliceAddr)).toBe(depositAmount);
    });
  });
});
