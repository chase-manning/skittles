import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestEnv, compileAndDeploy, connectAs, TestEnv, DeployedContract } from "./helpers";
import { ethers } from "ethers";

// ============================================================
// ERC20 TypeScript source (the contract under test)
// ============================================================

const ERC20_SOURCE = `
  class ERC20 {
    Transfer: SkittlesEvent<{ from: address; to: address; value: number }>;
    Approval: SkittlesEvent<{ owner: address; spender: address; value: number }>;

    public name: string = "MyToken";
    public symbol: string = "MTK";
    public decimals: number = 18;
    public totalSupply: number = 0;
    private balances: Record<address, number> = {};
    private allowances: Record<address, Record<address, number>> = {};

    constructor(initialSupply: number) {
      this.totalSupply = initialSupply;
      this.balances[msg.sender] = initialSupply;
    }

    public balanceOf(account: address): number {
      return this.balances[account];
    }

    public allowance(owner: address, spender: address): number {
      return this.allowances[owner][spender];
    }

    private _transfer(from: address, to: address, amount: number): void {
      if (this.balances[from] < amount) {
        throw new Error("ERC20: transfer amount exceeds balance");
      }
      this.balances[from] -= amount;
      this.balances[to] += amount;
      this.Transfer.emit({ from, to, value: amount });
    }

    public transfer(to: address, amount: number): boolean {
      this._transfer(msg.sender, to, amount);
      return true;
    }

    public approve(spender: address, amount: number): boolean {
      this.allowances[msg.sender][spender] = amount;
      this.Approval.emit({ owner: msg.sender, spender, value: amount });
      return true;
    }

    public transferFrom(from: address, to: address, amount: number): boolean {
      const spender: address = msg.sender;
      if (this.allowances[from][spender] < amount) {
        throw new Error("ERC20: insufficient allowance");
      }
      this.allowances[from][spender] -= amount;
      this._transfer(from, to, amount);
      return true;
    }
  }
`;

// ============================================================
// Behavioral tests
// ============================================================

describe("ERC20 behavioral tests", () => {
  let env: TestEnv;
  let token: DeployedContract;
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let bob: ethers.Signer;
  let deployerAddr: string;
  let aliceAddr: string;
  let bobAddr: string;

  const INITIAL_SUPPLY = 1_000_000n;

  beforeAll(async () => {
    env = await createTestEnv();
    deployer = env.accounts[0];
    alice = env.accounts[1];
    bob = env.accounts[2];
    deployerAddr = await deployer.getAddress();
    aliceAddr = await alice.getAddress();
    bobAddr = await bob.getAddress();

    token = await compileAndDeploy(env, ERC20_SOURCE, "ERC20", [INITIAL_SUPPLY]);
  }, 30_000);

  afterAll(async () => {
    await env?.server.close();
  });

  // ----------------------------------------------------------
  // Read only state: verify constructor and defaults
  // ----------------------------------------------------------

  describe("initial state", () => {
    it("should return the correct name", async () => {
      const name = await token.contract.name();
      expect(name).toBe("MyToken");
    });

    it("should return the correct symbol", async () => {
      const symbol = await token.contract.symbol();
      expect(symbol).toBe("MTK");
    });

    it("should return 18 decimals", async () => {
      const decimals = await token.contract.decimals();
      expect(decimals).toBe(18n);
    });

    it("should have the correct total supply", async () => {
      const supply = await token.contract.totalSupply();
      expect(supply).toBe(INITIAL_SUPPLY);
    });

    it("should assign the full supply to the deployer", async () => {
      const balance = await token.contract.balanceOf(deployerAddr);
      expect(balance).toBe(INITIAL_SUPPLY);
    });

    it("should have zero balance for other accounts", async () => {
      const balance = await token.contract.balanceOf(aliceAddr);
      expect(balance).toBe(0n);
    });

    it("should have zero allowance by default", async () => {
      const allowance = await token.contract.allowance(deployerAddr, aliceAddr);
      expect(allowance).toBe(0n);
    });
  });

  // ----------------------------------------------------------
  // Transfer
  // ----------------------------------------------------------

  describe("transfer", () => {
    it("should transfer tokens between accounts", async () => {
      const amount = 100n;
      const tx = await token.contract.transfer(aliceAddr, amount);
      await tx.wait();

      const deployerBal = await token.contract.balanceOf(deployerAddr);
      const aliceBal = await token.contract.balanceOf(aliceAddr);

      expect(deployerBal).toBe(INITIAL_SUPPLY - amount);
      expect(aliceBal).toBe(amount);
    });

    it("should emit a Transfer event", async () => {
      const amount = 50n;
      const tx = await token.contract.transfer(aliceAddr, amount);
      const receipt = await tx.wait();

      const iface = new ethers.Interface(token.abi);
      const transferEvent = receipt.logs
        .map((log: ethers.Log) => {
          try { return iface.parseLog(log); } catch { return null; }
        })
        .find((e: ethers.LogDescription | null) => e?.name === "Transfer");

      expect(transferEvent).toBeDefined();
      expect(transferEvent!.args[0]).toBe(deployerAddr);
      expect(transferEvent!.args[1]).toBe(aliceAddr);
      expect(transferEvent!.args[2]).toBe(amount);
    });

    it("should revert when transferring more than balance", async () => {
      const aliceToken = connectAs(token, alice);
      const tooMuch = INITIAL_SUPPLY * 10n;

      await expect(
        aliceToken.transfer(bobAddr, tooMuch)
      ).rejects.toThrow();
    });
  });

  // ----------------------------------------------------------
  // Approve and allowance
  // ----------------------------------------------------------

  describe("approve", () => {
    it("should set allowance", async () => {
      const amount = 500n;
      const tx = await token.contract.approve(aliceAddr, amount);
      await tx.wait();

      const allowance = await token.contract.allowance(deployerAddr, aliceAddr);
      expect(allowance).toBe(amount);
    });

    it("should emit an Approval event", async () => {
      const amount = 200n;
      const tx = await token.contract.approve(bobAddr, amount);
      const receipt = await tx.wait();

      const iface = new ethers.Interface(token.abi);
      const approvalEvent = receipt.logs
        .map((log: ethers.Log) => {
          try { return iface.parseLog(log); } catch { return null; }
        })
        .find((e: ethers.LogDescription | null) => e?.name === "Approval");

      expect(approvalEvent).toBeDefined();
      expect(approvalEvent!.args[0]).toBe(deployerAddr);
      expect(approvalEvent!.args[1]).toBe(bobAddr);
      expect(approvalEvent!.args[2]).toBe(amount);
    });

    it("should overwrite previous allowance", async () => {
      await (await token.contract.approve(aliceAddr, 999n)).wait();
      const allowance = await token.contract.allowance(deployerAddr, aliceAddr);
      expect(allowance).toBe(999n);
    });
  });

  // ----------------------------------------------------------
  // TransferFrom
  // ----------------------------------------------------------

  describe("transferFrom", () => {
    it("should transfer from an approved account", async () => {
      const approveAmount = 300n;
      const transferAmount = 100n;

      // Deployer approves alice
      await (await token.contract.approve(aliceAddr, approveAmount)).wait();

      // Get balances before
      const deployerBalBefore = await token.contract.balanceOf(deployerAddr);
      const bobBalBefore = await token.contract.balanceOf(bobAddr);

      // Alice calls transferFrom to move tokens from deployer to bob
      const aliceToken = connectAs(token, alice);
      const tx = await aliceToken.transferFrom(deployerAddr, bobAddr, transferAmount);
      await tx.wait();

      // Verify balances changed
      const deployerBalAfter = await token.contract.balanceOf(deployerAddr);
      const bobBalAfter = await token.contract.balanceOf(bobAddr);

      expect(deployerBalAfter).toBe(deployerBalBefore - transferAmount);
      expect(bobBalAfter).toBe(bobBalBefore + transferAmount);
    });

    it("should reduce allowance after transferFrom", async () => {
      const approveAmount = 1000n;
      const transferAmount = 400n;

      await (await token.contract.approve(aliceAddr, approveAmount)).wait();

      const aliceToken = connectAs(token, alice);
      await (await aliceToken.transferFrom(deployerAddr, bobAddr, transferAmount)).wait();

      const remaining = await token.contract.allowance(deployerAddr, aliceAddr);
      expect(remaining).toBe(approveAmount - transferAmount);
    });

    it("should revert when exceeding allowance", async () => {
      await (await token.contract.approve(aliceAddr, 10n)).wait();

      const aliceToken = connectAs(token, alice);
      await expect(
        aliceToken.transferFrom(deployerAddr, bobAddr, 100n)
      ).rejects.toThrow();
    });

    it("should revert when sender has insufficient balance", async () => {
      // Alice has some tokens from earlier transfers, but not much
      // Give alice a big allowance from bob, but bob has limited tokens
      const bobToken = connectAs(token, bob);
      await (await bobToken.approve(aliceAddr, 999_999_999n)).wait();

      const aliceToken = connectAs(token, alice);
      const bobBalance = await token.contract.balanceOf(bobAddr);

      await expect(
        aliceToken.transferFrom(bobAddr, deployerAddr, bobBalance + 1n)
      ).rejects.toThrow();
    });

    it("should emit Transfer event on transferFrom", async () => {
      const amount = 10n;
      await (await token.contract.approve(aliceAddr, amount)).wait();

      const aliceToken = connectAs(token, alice);
      const tx = await aliceToken.transferFrom(deployerAddr, bobAddr, amount);
      const receipt = await tx.wait();

      const iface = new ethers.Interface(token.abi);
      const transferEvent = receipt.logs
        .map((log: ethers.Log) => {
          try { return iface.parseLog(log); } catch { return null; }
        })
        .find((e: ethers.LogDescription | null) => e?.name === "Transfer");

      expect(transferEvent).toBeDefined();
      expect(transferEvent!.args[0]).toBe(deployerAddr);
      expect(transferEvent!.args[1]).toBe(bobAddr);
      expect(transferEvent!.args[2]).toBe(amount);
    });
  });

  // ----------------------------------------------------------
  // Total supply invariant
  // ----------------------------------------------------------

  describe("invariants", () => {
    it("total supply should never change from transfers", async () => {
      const supply = await token.contract.totalSupply();
      expect(supply).toBe(INITIAL_SUPPLY);
    });
  });
});
