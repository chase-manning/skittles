import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestEnv, compileAndDeploy, connectAs, TestEnv, DeployedContract } from "./helpers";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function readStdlib(name: string): string {
  const subdirs: Record<string, string> = {
    ERC20: "token",
    ERC20Permit: "token",
    ERC20Votes: "token",
    ERC721: "token",
    Ownable: "access",
    Pausable: "security",
    ReentrancyGuard: "security",
  };
  const subdir = subdirs[name] ?? "";
  const filePath = path.resolve(__dirname, `../../stdlib/contracts/${subdir}/${name}.ts`);
  const raw = fs.readFileSync(filePath, "utf-8");
  return raw.replace(/^import\s+.*from\s+["'].*["'];?\s*$/gm, "").trim();
}

// ============================================================
// ERC20 stdlib tests
// ============================================================

describe("stdlib ERC20", () => {
  let env: TestEnv;
  let token: DeployedContract;
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let bob: ethers.Signer;
  let deployerAddr: string;
  let aliceAddr: string;
  let bobAddr: string;

  const INITIAL_SUPPLY = 1_000_000n;

  const ERC20_BASE = readStdlib("ERC20");

  const TOKEN_SOURCE = `
${ERC20_BASE}

class MyToken extends ERC20 {
  private _owner: address;

  constructor(initialSupply: number) {
    super("TestToken", "TT");
    this._owner = msg.sender;
    this._mint(msg.sender, initialSupply);
  }

  public mint(to: address, amount: number): void {
    if (msg.sender != this._owner) {
      throw new Error("Not owner");
    }
    this._mint(to, amount);
  }

  public burn(from: address, amount: number): void {
    this._burn(from, amount);
  }
}
`;

  beforeAll(async () => {
    env = await createTestEnv();
    deployer = env.accounts[0];
    alice = env.accounts[1];
    bob = env.accounts[2];
    deployerAddr = await deployer.getAddress();
    aliceAddr = await alice.getAddress();
    bobAddr = await bob.getAddress();
    token = await compileAndDeploy(env, TOKEN_SOURCE, "MyToken", [INITIAL_SUPPLY]);
  }, 30_000);

  afterAll(async () => { await env?.server.close(); });

  describe("metadata", () => {
    it("returns the correct name", async () => {
      expect(await token.contract.name()).toBe("TestToken");
    });

    it("returns the correct symbol", async () => {
      expect(await token.contract.symbol()).toBe("TT");
    });

    it("returns 18 decimals", async () => {
      expect(await token.contract.decimals()).toBe(18n);
    });
  });

  describe("initial state", () => {
    it("has the correct total supply", async () => {
      expect(await token.contract.totalSupply()).toBe(INITIAL_SUPPLY);
    });

    it("assigns full supply to deployer", async () => {
      expect(await token.contract.balanceOf(deployerAddr)).toBe(INITIAL_SUPPLY);
    });

    it("has zero balance for other accounts", async () => {
      expect(await token.contract.balanceOf(aliceAddr)).toBe(0n);
    });
  });

  describe("transfer", () => {
    it("transfers tokens between accounts", async () => {
      const amount = 100n;
      await (await token.contract.transfer(aliceAddr, amount)).wait();
      const deployerBal = await token.contract.balanceOf(deployerAddr);
      const aliceBal = await token.contract.balanceOf(aliceAddr);
      expect(deployerBal).toBe(INITIAL_SUPPLY - amount);
      expect(aliceBal).toBe(amount);
    });

    it("emits Transfer event", async () => {
      const amount = 50n;
      const tx = await token.contract.transfer(aliceAddr, amount);
      const receipt = await tx.wait();
      const iface = new ethers.Interface(token.abi);
      const log = receipt.logs
        .map((l: ethers.Log) => { try { return iface.parseLog(l); } catch { return null; } })
        .find((e: ethers.LogDescription | null) => e?.name === "Transfer");
      expect(log).toBeDefined();
      expect(log!.args[0]).toBe(deployerAddr);
      expect(log!.args[1]).toBe(aliceAddr);
    });

    it("reverts on insufficient balance", async () => {
      const aliceToken = connectAs(token, alice);
      await expect(aliceToken.transfer(bobAddr, INITIAL_SUPPLY * 10n)).rejects.toThrow();
    });

    it("reverts when sending to zero address", async () => {
      await expect(token.contract.transfer(ZERO_ADDRESS, 1n)).rejects.toThrow();
    });
  });

  describe("approve & allowance", () => {
    it("sets allowance", async () => {
      await (await token.contract.approve(aliceAddr, 500n)).wait();
      expect(await token.contract.allowance(deployerAddr, aliceAddr)).toBe(500n);
    });

    it("emits Approval event", async () => {
      const tx = await token.contract.approve(bobAddr, 200n);
      const receipt = await tx.wait();
      const iface = new ethers.Interface(token.abi);
      const log = receipt.logs
        .map((l: ethers.Log) => { try { return iface.parseLog(l); } catch { return null; } })
        .find((e: ethers.LogDescription | null) => e?.name === "Approval");
      expect(log).toBeDefined();
    });

    it("overwrites previous allowance", async () => {
      await (await token.contract.approve(aliceAddr, 999n)).wait();
      expect(await token.contract.allowance(deployerAddr, aliceAddr)).toBe(999n);
    });
  });

  describe("transferFrom", () => {
    it("transfers from an approved account", async () => {
      await (await token.contract.approve(aliceAddr, 300n)).wait();
      const before = await token.contract.balanceOf(deployerAddr);
      const aliceToken = connectAs(token, alice);
      await (await aliceToken.transferFrom(deployerAddr, bobAddr, 100n)).wait();
      expect(await token.contract.balanceOf(deployerAddr)).toBe(before - 100n);
    });

    it("reduces allowance after transferFrom", async () => {
      await (await token.contract.approve(aliceAddr, 1000n)).wait();
      const aliceToken = connectAs(token, alice);
      await (await aliceToken.transferFrom(deployerAddr, bobAddr, 400n)).wait();
      expect(await token.contract.allowance(deployerAddr, aliceAddr)).toBe(600n);
    });

    it("reverts when exceeding allowance", async () => {
      await (await token.contract.approve(aliceAddr, 10n)).wait();
      const aliceToken = connectAs(token, alice);
      await expect(aliceToken.transferFrom(deployerAddr, bobAddr, 100n)).rejects.toThrow();
    });
  });

  describe("mint & burn", () => {
    it("allows owner to mint", async () => {
      const before = await token.contract.totalSupply();
      await (await token.contract.mint(aliceAddr, 500n)).wait();
      expect(await token.contract.balanceOf(aliceAddr)).toBeGreaterThan(0n);
      expect(await token.contract.totalSupply()).toBe(before + 500n);
    });

    it("reverts mint from non-owner", async () => {
      const aliceToken = connectAs(token, alice);
      await expect(aliceToken.mint(bobAddr, 100n)).rejects.toThrow();
    });

    it("allows burn", async () => {
      const before = await token.contract.totalSupply();
      const deployerBal = await token.contract.balanceOf(deployerAddr);
      await (await token.contract.burn(deployerAddr, 100n)).wait();
      expect(await token.contract.balanceOf(deployerAddr)).toBe(deployerBal - 100n);
      expect(await token.contract.totalSupply()).toBe(before - 100n);
    });

    it("reverts burn exceeding balance", async () => {
      const bal = await token.contract.balanceOf(bobAddr);
      await expect(token.contract.burn(bobAddr, bal + 1n)).rejects.toThrow();
    });
  });
});

// ============================================================
// Ownable stdlib tests
// ============================================================

describe("stdlib Ownable", () => {
  let env: TestEnv;
  let contract: DeployedContract;
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let deployerAddr: string;
  let aliceAddr: string;

  const OWNABLE_BASE = readStdlib("Ownable");

  const OWNABLE_SOURCE = `
${OWNABLE_BASE}

class OwnableToken extends Ownable {
  public value: number = 0;

  constructor() {
    super(msg.sender);
  }

  public setValue(newValue: number): void {
    this._checkOwner();
    this.value = newValue;
  }
}
`;

  beforeAll(async () => {
    env = await createTestEnv();
    deployer = env.accounts[0];
    alice = env.accounts[1];
    deployerAddr = await deployer.getAddress();
    aliceAddr = await alice.getAddress();
    contract = await compileAndDeploy(env, OWNABLE_SOURCE, "OwnableToken");
  }, 30_000);

  afterAll(async () => { await env?.server.close(); });

  it("sets the deployer as owner", async () => {
    expect(await contract.contract.owner()).toBe(deployerAddr);
  });

  it("allows owner to call restricted functions", async () => {
    await (await contract.contract.setValue(42n)).wait();
    expect(await contract.contract.value()).toBe(42n);
  });

  it("reverts when non-owner calls restricted function", async () => {
    const aliceContract = connectAs(contract, alice);
    await expect(aliceContract.setValue(99n)).rejects.toThrow();
  });

  it("transfers ownership", async () => {
    await (await contract.contract.transferOwnership(aliceAddr)).wait();
    expect(await contract.contract.owner()).toBe(aliceAddr);
  });

  it("new owner can call restricted functions", async () => {
    const aliceContract = connectAs(contract, alice);
    await (await aliceContract.setValue(77n)).wait();
    expect(await contract.contract.value()).toBe(77n);
  });

  it("old owner cannot call restricted functions after transfer", async () => {
    await expect(contract.contract.setValue(1n)).rejects.toThrow();
  });

  it("reverts transferOwnership from non-owner", async () => {
    await expect(contract.contract.transferOwnership(deployerAddr)).rejects.toThrow();
  });

  it("allows owner to renounce ownership", async () => {
    const aliceContract = connectAs(contract, alice);
    await (await aliceContract.renounceOwnership()).wait();
    expect(await contract.contract.owner()).toBe(ZERO_ADDRESS);
  });

  it("nobody can call restricted functions after renounce", async () => {
    const aliceContract = connectAs(contract, alice);
    await expect(aliceContract.setValue(1n)).rejects.toThrow();
  });
});

// ============================================================
// ERC721 stdlib tests
// ============================================================

describe("stdlib ERC721", () => {
  let env: TestEnv;
  let nft: DeployedContract;
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let bob: ethers.Signer;
  let deployerAddr: string;
  let aliceAddr: string;
  let bobAddr: string;

  const ERC721_BASE = readStdlib("ERC721");

  const NFT_SOURCE = `
${ERC721_BASE}

class MyNFT extends ERC721 {
  private _nextTokenId: number = 0;

  constructor() {
    super("TestNFT", "TNFT");
  }

  public mint(to: address): number {
    let tokenId: number = this._nextTokenId;
    this._nextTokenId += 1;
    this._mint(to, tokenId);
    return tokenId;
  }

  public burn(tokenId: number): void {
    this._burn(tokenId);
  }
}
`;

  beforeAll(async () => {
    env = await createTestEnv();
    deployer = env.accounts[0];
    alice = env.accounts[1];
    bob = env.accounts[2];
    deployerAddr = await deployer.getAddress();
    aliceAddr = await alice.getAddress();
    bobAddr = await bob.getAddress();
    nft = await compileAndDeploy(env, NFT_SOURCE, "MyNFT");
  }, 30_000);

  afterAll(async () => { await env?.server.close(); });

  describe("metadata", () => {
    it("returns the correct name", async () => {
      expect(await nft.contract.name()).toBe("TestNFT");
    });

    it("returns the correct symbol", async () => {
      expect(await nft.contract.symbol()).toBe("TNFT");
    });
  });

  describe("minting", () => {
    it("mints a token to an address", async () => {
      await (await nft.contract.mint(deployerAddr)).wait();
      expect(await nft.contract.ownerOf(0n)).toBe(deployerAddr);
      expect(await nft.contract.balanceOf(deployerAddr)).toBe(1n);
    });

    it("increments balance on multiple mints", async () => {
      await (await nft.contract.mint(deployerAddr)).wait();
      await (await nft.contract.mint(deployerAddr)).wait();
      expect(await nft.contract.balanceOf(deployerAddr)).toBe(3n);
    });

    it("reverts minting to zero address", async () => {
      await expect(nft.contract.mint(ZERO_ADDRESS)).rejects.toThrow();
    });
  });

  describe("transfers", () => {
    it("transfers token via transferFrom", async () => {
      await (await nft.contract.transferFrom(deployerAddr, aliceAddr, 0n)).wait();
      expect(await nft.contract.ownerOf(0n)).toBe(aliceAddr);
    });

    it("reverts transferFrom by non-owner without approval", async () => {
      const bobNft = connectAs(nft, bob);
      await expect(bobNft.transferFrom(aliceAddr, bobAddr, 0n)).rejects.toThrow();
    });

    it("reverts transfer to zero address", async () => {
      await expect(nft.contract.transferFrom(deployerAddr, ZERO_ADDRESS, 1n)).rejects.toThrow();
    });
  });

  describe("approvals", () => {
    it("approves a specific address for a token", async () => {
      const aliceNft = connectAs(nft, alice);
      await (await aliceNft.approve(bobAddr, 0n)).wait();
      expect(await nft.contract.getApproved(0n)).toBe(bobAddr);
    });

    it("approved address can transfer", async () => {
      await (await nft.contract.mint(aliceAddr)).wait();
      const tokenId = 3n;
      const aliceNft = connectAs(nft, alice);
      await (await aliceNft.approve(bobAddr, tokenId)).wait();
      const bobNft = connectAs(nft, bob);
      await (await bobNft.transferFrom(aliceAddr, bobAddr, tokenId)).wait();
      expect(await nft.contract.ownerOf(tokenId)).toBe(bobAddr);
    });

    it("sets approval for all", async () => {
      await (await nft.contract.setApprovalForAll(aliceAddr, true)).wait();
      expect(await nft.contract.isApprovedForAll(deployerAddr, aliceAddr)).toBe(true);
    });

    it("operator can transfer any token of owner", async () => {
      const aliceNft = connectAs(nft, alice);
      await (await aliceNft.transferFrom(deployerAddr, aliceAddr, 1n)).wait();
      expect(await nft.contract.ownerOf(1n)).toBe(aliceAddr);
    });

    it("reverts approval for zero address operator", async () => {
      await expect(nft.contract.setApprovalForAll(ZERO_ADDRESS, true)).rejects.toThrow();
    });
  });

  describe("burning", () => {
    it("burns a token", async () => {
      const aliceNft = connectAs(nft, alice);
      await (await aliceNft.burn(1n)).wait();
      await expect(nft.contract.ownerOf(1n)).rejects.toThrow();
    });

    it("decrements balance on burn", async () => {
      const before = await nft.contract.balanceOf(aliceAddr);
      const aliceNft = connectAs(nft, alice);
      await (await aliceNft.burn(0n)).wait();
      expect(await nft.contract.balanceOf(aliceAddr)).toBe(before - 1n);
    });

    it("reverts burn of nonexistent token", async () => {
      await expect(nft.contract.burn(999n)).rejects.toThrow();
    });
  });
});

// ============================================================
// Pausable stdlib tests
// ============================================================

describe("stdlib Pausable", () => {
  let env: TestEnv;
  let contract: DeployedContract;
  let deployer: ethers.Signer;

  const PAUSABLE_BASE = readStdlib("Pausable");

  const PAUSABLE_SOURCE = `
${PAUSABLE_BASE}

class PausableVault extends Pausable {
  public value: number = 0;

  public deposit(amount: number): void {
    this._requireNotPaused();
    this.value += amount;
  }

  public pause(): void {
    this._pause();
  }

  public unpause(): void {
    this._unpause();
  }
}
`;

  beforeAll(async () => {
    env = await createTestEnv();
    deployer = env.accounts[0];
    contract = await compileAndDeploy(env, PAUSABLE_SOURCE, "PausableVault");
  }, 30_000);

  afterAll(async () => { await env?.server.close(); });

  it("starts unpaused", async () => {
    expect(await contract.contract.paused()).toBe(false);
  });

  it("allows deposits when not paused", async () => {
    await (await contract.contract.deposit(100n)).wait();
    expect(await contract.contract.value()).toBe(100n);
  });

  it("can be paused", async () => {
    await (await contract.contract.pause()).wait();
    expect(await contract.contract.paused()).toBe(true);
  });

  it("reverts deposits when paused", async () => {
    await expect(contract.contract.deposit(50n)).rejects.toThrow();
  });

  it("reverts double pause", async () => {
    await expect(contract.contract.pause()).rejects.toThrow();
  });

  it("can unpause and deposit again", async () => {
    await (await contract.contract.unpause()).wait();
    expect(await contract.contract.paused()).toBe(false);
    const tx = await contract.contract.deposit.populateTransaction(50n);
    tx.gasLimit = 500000n;
    const deployer = env.accounts[0];
    const sent = await deployer.sendTransaction(tx);
    await sent.wait();
    expect(await contract.contract.value()).toBe(150n);
  });

  it("reverts double unpause", async () => {
    await expect(contract.contract.unpause()).rejects.toThrow();
  });
});

// ============================================================
// ReentrancyGuard stdlib tests
// ============================================================

describe("stdlib ReentrancyGuard", () => {
  let env: TestEnv;
  let contract: DeployedContract;

  const GUARD_BASE = readStdlib("ReentrancyGuard");

  const GUARD_SOURCE = `
${GUARD_BASE}

class GuardedVault extends ReentrancyGuard {
  public value: number = 0;

  public deposit(amount: number): void {
    this._nonReentrantBefore();
    this.value += amount;
    this._nonReentrantAfter();
  }

  public reentrancyStatus(): boolean {
    return this._reentrancyGuardEntered();
  }
}
`;

  beforeAll(async () => {
    env = await createTestEnv();
    contract = await compileAndDeploy(env, GUARD_SOURCE, "GuardedVault");
  }, 30_000);

  afterAll(async () => { await env?.server.close(); });

  it("allows normal calls", async () => {
    await (await contract.contract.deposit(100n)).wait();
    expect(await contract.contract.value()).toBe(100n);
  });

  it("reports not entered after call completes", async () => {
    expect(await contract.contract.reentrancyStatus()).toBe(false);
  });
});

// ============================================================
// ERC20Permit stdlib tests
// ============================================================

describe("stdlib ERC20Permit", () => {
  let env: TestEnv;
  let token: DeployedContract;
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let deployerAddr: string;
  let aliceAddr: string;

  const INITIAL_SUPPLY = 1_000_000n;

  const ERC20_BASE = readStdlib("ERC20");
  const PERMIT_BASE = readStdlib("ERC20Permit");

  const PERMIT_SOURCE = `
${ERC20_BASE}

${PERMIT_BASE}

class MyPermitToken extends ERC20Permit {
  constructor(initialSupply: number) {
    super("PermitToken", "PT");
    this._mint(msg.sender, initialSupply);
  }
}
`;

  beforeAll(async () => {
    env = await createTestEnv();
    deployer = env.accounts[0];
    alice = env.accounts[1];
    deployerAddr = await deployer.getAddress();
    aliceAddr = await alice.getAddress();
    token = await compileAndDeploy(env, PERMIT_SOURCE, "MyPermitToken", [INITIAL_SUPPLY]);
  }, 60_000);

  afterAll(async () => { await env?.server.close(); });

  it("inherits ERC20 functionality", async () => {
    expect(await token.contract.name()).toBe("PermitToken");
    expect(await token.contract.symbol()).toBe("PT");
    expect(await token.contract.totalSupply()).toBe(INITIAL_SUPPLY);
  });

  it("starts with nonce 0", async () => {
    expect(await token.contract.nonces(deployerAddr)).toBe(0n);
  });

  it("returns a DOMAIN_SEPARATOR", async () => {
    const ds = await token.contract.DOMAIN_SEPARATOR();
    expect(ds).toBeTruthy();
    expect(typeof ds).toBe("string");
    expect(ds.length).toBe(66); // bytes32 hex string
  });

  it("reverts permit with expired deadline", async () => {
    const r = ethers.zeroPadValue("0x01", 32);
    const s = ethers.zeroPadValue("0x02", 32);
    await expect(
      token.contract.permit(deployerAddr, aliceAddr, 100n, 0n, 27n, r, s)
    ).rejects.toThrow();
  });

  it("executes a valid permit", async () => {
    const contractAddr = await token.contract.getAddress();
    const nonce = await token.contract.nonces(deployerAddr);
    const deadline = BigInt(Math.floor(Date.now() / 1000)) + 3600n;
    const value = 500n;

    // Build the EIP-712 domain and types
    const domain = {
      name: "PermitToken",
      version: "1",
      chainId: (await env.provider.getNetwork()).chainId,
      verifyingContract: contractAddr,
    };
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const message = {
      owner: deployerAddr,
      spender: aliceAddr,
      value,
      nonce,
      deadline,
    };

    // Sign the typed data
    const sig = await deployer.signTypedData(domain, types, message);
    const { v, r, s } = ethers.Signature.from(sig);

    // Submit permit from alice (gasless approval for deployer)
    const aliceToken = connectAs(token, alice);
    await (await aliceToken.permit(deployerAddr, aliceAddr, value, deadline, BigInt(v), r, s)).wait();

    // Verify allowance was set
    expect(await token.contract.allowance(deployerAddr, aliceAddr)).toBe(value);
    // Verify nonce incremented
    expect(await token.contract.nonces(deployerAddr)).toBe(nonce + 1n);
  });

  it("reverts permit with invalid signer", async () => {
    const contractAddr = await token.contract.getAddress();
    const nonce = await token.contract.nonces(deployerAddr);
    const deadline = BigInt(Math.floor(Date.now() / 1000)) + 3600n;
    const value = 100n;

    // Sign with alice but claim it's from deployer
    const domain = {
      name: "PermitToken",
      version: "1",
      chainId: (await env.provider.getNetwork()).chainId,
      verifyingContract: contractAddr,
    };
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const message = {
      owner: deployerAddr,
      spender: aliceAddr,
      value,
      nonce,
      deadline,
    };

    // Alice signs instead of deployer
    const sig = await alice.signTypedData(domain, types, message);
    const { v, r, s } = ethers.Signature.from(sig);

    await expect(
      token.contract.permit(deployerAddr, aliceAddr, value, deadline, BigInt(v), r, s)
    ).rejects.toThrow();
  });
});

// ============================================================
// ERC20Votes stdlib tests
// ============================================================

describe("stdlib ERC20Votes", () => {
  let env: TestEnv;
  let token: DeployedContract;
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let bob: ethers.Signer;
  let deployerAddr: string;
  let aliceAddr: string;
  let bobAddr: string;

  const INITIAL_SUPPLY = 1_000_000n;

  const ERC20_BASE = readStdlib("ERC20");
  const VOTES_BASE = readStdlib("ERC20Votes");

  const VOTES_SOURCE = `
${ERC20_BASE}

${VOTES_BASE}

class MyVotesToken extends ERC20Votes {
  constructor(initialSupply: number) {
    super("VotesToken", "VT");
    this._mint(msg.sender, initialSupply);
  }
}
`;

  beforeAll(async () => {
    env = await createTestEnv();
    deployer = env.accounts[0];
    alice = env.accounts[1];
    bob = env.accounts[2];
    deployerAddr = await deployer.getAddress();
    aliceAddr = await alice.getAddress();
    bobAddr = await bob.getAddress();
    token = await compileAndDeploy(env, VOTES_SOURCE, "MyVotesToken", [INITIAL_SUPPLY]);
  }, 60_000);

  afterAll(async () => { await env?.server.close(); });

  it("inherits ERC20 functionality", async () => {
    expect(await token.contract.name()).toBe("VotesToken");
    expect(await token.contract.symbol()).toBe("VT");
    expect(await token.contract.totalSupply()).toBe(INITIAL_SUPPLY);
    expect(await token.contract.balanceOf(deployerAddr)).toBe(INITIAL_SUPPLY);
  });

  it("starts with no delegates", async () => {
    expect(await token.contract.delegates(deployerAddr)).toBe(ZERO_ADDRESS);
  });

  it("starts with zero votes", async () => {
    expect(await token.contract.getVotes(deployerAddr)).toBe(0n);
  });

  it("self-delegation activates voting power", async () => {
    await (await token.contract.delegate(deployerAddr)).wait();
    expect(await token.contract.delegates(deployerAddr)).toBe(deployerAddr);
    expect(await token.contract.getVotes(deployerAddr)).toBe(INITIAL_SUPPLY);
  });

  it("delegation to another transfers voting power", async () => {
    await (await token.contract.delegate(aliceAddr)).wait();
    expect(await token.contract.delegates(deployerAddr)).toBe(aliceAddr);
    expect(await token.contract.getVotes(deployerAddr)).toBe(0n);
    expect(await token.contract.getVotes(aliceAddr)).toBe(INITIAL_SUPPLY);
  });

  it("transfer moves delegate votes", async () => {
    // deployer has delegated to alice, transfer some tokens to bob
    // bob self-delegates first
    const bobToken = connectAs(token, bob);
    await (await bobToken.delegate(bobAddr)).wait();

    const transferAmount = 100_000n;
    await (await token.contract.transfer(bobAddr, transferAmount)).wait();

    // alice's votes should decrease, bob's should increase
    expect(await token.contract.getVotes(aliceAddr)).toBe(INITIAL_SUPPLY - transferAmount);
    expect(await token.contract.getVotes(bobAddr)).toBe(transferAmount);
  });

  it("re-delegation moves votes correctly", async () => {
    // bob re-delegates to alice
    const bobToken = connectAs(token, bob);
    const bobBalance = await token.contract.balanceOf(bobAddr);
    const aliceVotesBefore = await token.contract.getVotes(aliceAddr);

    await (await bobToken.delegate(aliceAddr)).wait();
    expect(await token.contract.delegates(bobAddr)).toBe(aliceAddr);
    expect(await token.contract.getVotes(bobAddr)).toBe(0n);
    expect(await token.contract.getVotes(aliceAddr)).toBe(aliceVotesBefore + bobBalance);
  });
});

// ============================================================
// Stdlib full-pipeline integration test (uses the compiler)
// ============================================================

describe("stdlib compiler integration", () => {
  let env: TestEnv;

  beforeAll(async () => {
    env = await createTestEnv();
  }, 30_000);

  afterAll(async () => { await env?.server.close(); });

  it("compiles a user contract that extends stdlib ERC20 via the full pipeline", async () => {
    const { compile } = await import("../../src/compiler/compiler");
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skittles-stdlib-test-"));
    const contractsDir = path.join(tmpDir, "contracts");
    fs.mkdirSync(contractsDir, { recursive: true });

    fs.writeFileSync(
      path.join(contractsDir, "MyToken.ts"),
      `import { address, msg } from "skittles";
import { ERC20 } from "skittles/contracts";

export class MyToken extends ERC20 {
  constructor() {
    super("IntegrationToken", "IT");
    this._mint(msg.sender, 1000000);
  }

  public mint(to: address, amount: number): void {
    this._mint(to, amount);
  }
}
`
    );

    const result = await compile(tmpDir, {
      typeCheck: false,
      consoleLog: false,
      contractsDir: "contracts",
      outputDir: "artifacts",
      cacheDir: "cache",
    });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);

    const solDir = path.join(tmpDir, "artifacts", "solidity");
    const myTokenSol = fs.readFileSync(path.join(solDir, "MyToken.sol"), "utf-8");
    const erc20Sol = fs.readFileSync(path.join(solDir, "ERC20.sol"), "utf-8");

    expect(myTokenSol).toContain('import "./ERC20.sol"');
    expect(myTokenSol).toContain("contract MyToken is ERC20");
    expect(myTokenSol).toContain('ERC20("IntegrationToken", "IT")');
    expect(erc20Sol).toContain("contract ERC20");
    expect(erc20Sol).toContain("function transfer");
    expect(erc20Sol).toContain("function _mint");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
