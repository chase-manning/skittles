import { describe, it, expect, beforeAll } from "vitest";
import { ethers } from "ethers";
import { setup } from "skittles/testing";

const INITIAL_SUPPLY = ethers.parseEther("1000000");

describe("Token", () => {
  const env = setup();
  let token: ethers.Contract;
  let ownerAddr: string;
  let aliceAddr: string;
  let bobAddr: string;

  beforeAll(async () => {
    ownerAddr = await env.accounts[0].getAddress();
    aliceAddr = await env.accounts[1].getAddress();
    bobAddr = await env.accounts[2].getAddress();

    token = await env.deploy("Token", [INITIAL_SUPPLY]);
  });

  describe("deployment", () => {
    it("should set the token name", async () => {
      expect(await token.name()).toBe("Skittles Token");
    });

    it("should set the token symbol", async () => {
      expect(await token.symbol()).toBe("SKT");
    });

    it("should set 18 decimals", async () => {
      expect(await token.decimals()).toBe(18n);
    });

    it("should mint the initial supply to the deployer", async () => {
      expect(await token.totalSupply()).toBe(INITIAL_SUPPLY);
      expect(await token.balanceOf(ownerAddr)).toBe(INITIAL_SUPPLY);
    });
  });

  describe("transfer", () => {
    it("should transfer tokens between accounts", async () => {
      const amount = ethers.parseEther("100");
      await token.transfer(aliceAddr, amount);

      expect(await token.balanceOf(aliceAddr)).toBe(amount);
      expect(await token.balanceOf(ownerAddr)).toBe(
        INITIAL_SUPPLY - amount
      );
    });

    it("should emit a Transfer event", async () => {
      const amount = ethers.parseEther("50");
      const tx = await token.transfer(aliceAddr, amount);
      const events = await env.emitted(tx, token, "Transfer");
      expect(events).toHaveLength(1);
      expect(events[0].from).toBe(ownerAddr);
      expect(events[0].to).toBe(aliceAddr);
      expect(events[0].value).toBe(amount);
    });

    it("should revert when transfer amount exceeds balance", async () => {
      const aliceToken = env.connectAs(token, env.accounts[1]);
      const tooMuch = ethers.parseEther("999999999");
      await expect(
        aliceToken.transfer(bobAddr, tooMuch)
      ).rejects.toThrow();
    });
  });

  describe("approve and transferFrom", () => {
    it("should set allowance", async () => {
      const amount = ethers.parseEther("200");
      await token.approve(aliceAddr, amount);
      expect(await token.allowance(ownerAddr, aliceAddr)).toBe(amount);
    });

    it("should emit an Approval event", async () => {
      const amount = ethers.parseEther("300");
      const tx = await token.approve(aliceAddr, amount);
      const events = await env.emitted(tx, token, "Approval");
      expect(events).toHaveLength(1);
      expect(events[0].owner).toBe(ownerAddr);
      expect(events[0].spender).toBe(aliceAddr);
      expect(events[0].value).toBe(amount);
    });

    it("should allow transferFrom within allowance", async () => {
      const allowance = ethers.parseEther("1000");
      await token.approve(aliceAddr, allowance);

      const transferAmount = ethers.parseEther("500");
      const aliceToken = env.connectAs(token, env.accounts[1]);
      await aliceToken.transferFrom(ownerAddr, bobAddr, transferAmount);

      expect(await token.balanceOf(bobAddr)).toBe(transferAmount);
      expect(await token.allowance(ownerAddr, aliceAddr)).toBe(
        allowance - transferAmount
      );
    });

    it("should revert transferFrom when allowance is exceeded", async () => {
      const aliceToken = env.connectAs(token, env.accounts[1]);
      const tooMuch = ethers.parseEther("999999999");
      await expect(
        aliceToken.transferFrom(ownerAddr, bobAddr, tooMuch)
      ).rejects.toThrow();
    });
  });
});
