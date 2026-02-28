import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestEnv,
  compileAndDeploy,
  type TestEnv,
  type DeployedContract,
} from "./helpers";
import { parse } from "../../src/compiler/parser";
import { generateSolidityFile } from "../../src/compiler/codegen";
import { compileSolidity } from "../../src/compiler/solc";
import { defaultConfig } from "../fixtures";
import { ethers } from "ethers";

const ENUM_SOURCE = `
enum Status { Pending, Active, Closed }

class Proposal {
  public status: Status;

  public activate(): void {
    this.status = Status.Active;
  }

  public close(): void {
    this.status = Status.Closed;
  }

  public getStatus(): Status {
    return this.status;
  }
}
`;

const CUSTOM_ERROR_SOURCE = `
class Unauthorized extends Error {
  constructor(caller: address) {
    super("");
  }
}

class Guarded {
  private owner: address = msg.sender;

  public getOwner(): address {
    return this.owner;
  }

  public onlyOwnerAction(): number {
    if (msg.sender != this.owner) {
      throw new Unauthorized(msg.sender);
    }
    return 42;
  }
}
`;

const CONSTANT_SOURCE = `
class Constants {
  static readonly MAX: number = 1000;
  static readonly NAME: string = "MyContract";
  readonly deployer: address = msg.sender;

  public getMax(): number {
    return Constants.MAX;
  }

  public getDeployer(): address {
    return this.deployer;
  }
}
`;

const INDEXED_EVENT_SOURCE = `
class EventToken {
  Transfer: SkittlesEvent<{ from: Indexed<address>; to: Indexed<address>; value: number }> = {} as any;

  private balances: Record<address, number> = {};

  constructor(supply: number) {
    this.balances[msg.sender] = supply;
  }

  public transfer(to: address, amount: number): void {
    if (this.balances[msg.sender] < amount) {
      throw new Error("Insufficient balance");
    }
    this.balances[msg.sender] -= amount;
    this.balances[to] += amount;
    this.Transfer.emit(msg.sender, to, amount);
  }

  public balanceOf(account: address): number {
    return this.balances[account];
  }
}
`;

const RECEIVE_SOURCE = `
class Vault {
  private deposits: Record<address, number> = {};
  private totalDeposited: number = 0;

  public receive(): void {
    this.deposits[msg.sender] += msg.value;
    this.totalDeposited += msg.value;
  }

  public getDeposit(account: address): number {
    return this.deposits[account];
  }

  public getTotal(): number {
    return this.totalDeposited;
  }
}
`;

const TRANSFER_ETH_SOURCE = `
class PaymentSplitter {
  private owner: address = msg.sender;

  public receive(): void {}

  public sendPayment(to: address, amount: number): void {
    if (msg.sender != this.owner) {
      throw new Error("Not owner");
    }
    to.transfer(amount);
  }
}
`;

const INHERITANCE_SOURCE = `
class Base {
  public x: number = 0;

  public setX(val: number): void {
    this.x = val;
  }

  public getX(): number {
    return this.x;
  }
}

class Child extends Base {
  public y: number = 0;

  public setY(val: number): void {
    this.y = val;
  }

  public override getX(): number {
    return this.x + 1;
  }
}
`;

const READONLY_ARRAY_SOURCE = `
class AdminRegistry {
  public readonly admins: address[] = [];

  constructor(admin: address) {
    this.admins.push(admin);
  }

  public getAdminCount(): number {
    return this.admins.length;
  }
}
`;

let env: TestEnv;

beforeAll(async () => {
  env = await createTestEnv();
}, 30000);

afterAll(async () => {
  await env.server.close();
});

describe("behavioral: enums", () => {
  let contract: DeployedContract;

  beforeAll(async () => {
    contract = await compileAndDeploy(env, ENUM_SOURCE, "Proposal");
  });

  it("should default to first enum value (0)", async () => {
    expect(await contract.contract.getStatus()).toBe(0n);
  });

  it("should set enum to Active (1)", async () => {
    await contract.contract.activate();
    expect(await contract.contract.getStatus()).toBe(1n);
  });

  it("should set enum to Closed (2)", async () => {
    await contract.contract.close();
    expect(await contract.contract.getStatus()).toBe(2n);
  });
});

describe("behavioral: custom errors", () => {
  let contract: DeployedContract;

  beforeAll(async () => {
    contract = await compileAndDeploy(env, CUSTOM_ERROR_SOURCE, "Guarded");
  });

  it("should allow owner to call onlyOwnerAction", async () => {
    expect(await contract.contract.onlyOwnerAction()).toBe(42n);
  });

  it("should revert with custom error for non-owner", async () => {
    const nonOwner = contract.contract.connect(env.accounts[1]) as ethers.Contract;
    await expect(nonOwner.onlyOwnerAction()).rejects.toThrow();
  });
});

describe("behavioral: constants and immutables", () => {
  let contract: DeployedContract;

  beforeAll(async () => {
    contract = await compileAndDeploy(env, CONSTANT_SOURCE, "Constants");
  });

  it("should return constant MAX", async () => {
    expect(await contract.contract.getMax()).toBe(1000n);
  });

  it("should return immutable deployer", async () => {
    const deployer = await env.accounts[0].getAddress();
    expect(await contract.contract.getDeployer()).toBe(deployer);
  });
});

describe("behavioral: indexed events", () => {
  let contract: DeployedContract;

  beforeAll(async () => {
    contract = await compileAndDeploy(env, INDEXED_EVENT_SOURCE, "EventToken", [1000]);
  });

  it("should emit Transfer event with indexed parameters", async () => {
    const receiver = await env.accounts[1].getAddress();
    const tx = await contract.contract.transfer(receiver, 100);
    const receipt = await tx.wait();

    expect(receipt.logs.length).toBe(1);

    const iface = new ethers.Interface(contract.abi as ethers.InterfaceAbi);
    const log = iface.parseLog(receipt.logs[0]);
    expect(log?.name).toBe("Transfer");
    expect(log?.args[2]).toBe(100n);
  });
});

describe("behavioral: receive function", () => {
  let contract: DeployedContract;

  beforeAll(async () => {
    contract = await compileAndDeploy(env, RECEIVE_SOURCE, "Vault");
  });

  it("should accept ETH via receive", async () => {
    const signer = env.accounts[0];
    const amount = ethers.parseEther("1.0");
    await signer.sendTransaction({
      to: contract.address,
      value: amount,
    });

    const deposit = await contract.contract.getDeposit(await signer.getAddress());
    expect(deposit).toBe(amount);
  });

  it("should track total deposits", async () => {
    const total = await contract.contract.getTotal();
    expect(total).toBe(ethers.parseEther("1.0"));
  });
});

describe("behavioral: ETH transfers", () => {
  let contract: DeployedContract;

  beforeAll(async () => {
    contract = await compileAndDeploy(env, TRANSFER_ETH_SOURCE, "PaymentSplitter");
  });

  it("should transfer ETH to a recipient", async () => {
    const recipient = env.accounts[2];
    const recipientAddr = await recipient.getAddress();
    const sendAmount = ethers.parseEther("2.0");

    // Fund the contract
    const owner = env.accounts[0];
    const fundTx = await owner.sendTransaction({
      to: contract.address,
      value: sendAmount,
    });
    await fundTx.wait();

    const balanceBefore = BigInt(await env.provider.send('eth_getBalance', [recipientAddr, 'latest']));

    // Send payment
    const tx = await contract.contract.sendPayment(recipientAddr, ethers.parseEther("1.0"));
    await tx.wait();

    const balanceAfter = BigInt(await env.provider.send('eth_getBalance', [recipientAddr, 'latest']));
    expect(balanceAfter - balanceBefore).toBe(ethers.parseEther("1.0"));
  });
});

describe("behavioral: inheritance with override", () => {
  let contract: DeployedContract;

  beforeAll(async () => {
    const contracts = parse(INHERITANCE_SOURCE, "test.ts");
    const solidity = generateSolidityFile(contracts);
    const compiled = compileSolidity("Child", solidity, defaultConfig);
    if (compiled.errors.length > 0) {
      throw new Error(`Solc errors: ${compiled.errors.join("\n")}`);
    }
    const deployer = env.accounts[0];
    const factory = new ethers.ContractFactory(
      compiled.abi,
      "0x" + compiled.bytecode,
      deployer
    );
    const deployed = await factory.deploy();
    await deployed.waitForDeployment();
    const address = await deployed.getAddress();
    contract = {
      contract: new ethers.Contract(address, compiled.abi, deployer),
      address,
      abi: compiled.abi,
    };
  });

  it("should use overridden getX (x + 1)", async () => {
    await contract.contract.setX(10);
    expect(await contract.contract.getX()).toBe(11n);
  });

  it("should use parent setX", async () => {
    await contract.contract.setX(50);
    expect(await contract.contract.getX()).toBe(51n);
  });

  it("should use child setY", async () => {
    await contract.contract.setY(99);
    expect(await contract.contract.y()).toBe(99n);
  });
});

const DEFAULT_PARAM_SOURCE = `
class DefaultToken {
  public totalSupply: number = 0;

  constructor(supply: number = 1000000) {
    this.totalSupply = supply;
  }

  public getSupply(): number {
    return this.totalSupply;
  }
}
`;

const MIXED_PARAM_SOURCE = `
class MixedToken {
  public tokenName: string = "";
  public totalSupply: number = 0;

  constructor(name: string, supply: number = 500) {
    this.tokenName = name;
    this.totalSupply = supply;
  }

  public getName(): string {
    return this.tokenName;
  }

  public getSupply(): number {
    return this.totalSupply;
  }
}
`;

const EXPONENTIATION_SOURCE = `
class MathPow {
  private value: number = 2;

  public power(base: number, exp: number): number {
    return base ** exp;
  }

  public scale(decimals: number): number {
    return 10 ** decimals;
  }

  public getValue(): number {
    return this.value;
  }

  public powerAssign(exp: number): void {
    this.value **= exp;
  }
}
`;

describe("behavioral: constructor with default parameters", () => {
  let contract: DeployedContract;

  beforeAll(async () => {
    contract = await compileAndDeploy(env, DEFAULT_PARAM_SOURCE, "DefaultToken");
  });

  it("should use default supply value", async () => {
    expect(await contract.contract.getSupply()).toBe(1000000n);
  });
});

describe("behavioral: constructor with mixed default and required parameters", () => {
  let contract: DeployedContract;

  beforeAll(async () => {
    contract = await compileAndDeploy(env, MIXED_PARAM_SOURCE, "MixedToken", ["MyToken"]);
  });

  it("should accept required parameter", async () => {
    expect(await contract.contract.getName()).toBe("MyToken");
  });

  it("should use default supply value", async () => {
    expect(await contract.contract.getSupply()).toBe(500n);
  });
});

describe("behavioral: exponentiation", () => {
  let contract: DeployedContract;

  beforeAll(async () => {
    contract = await compileAndDeploy(env, EXPONENTIATION_SOURCE, "MathPow");
  });

  it("should compute base ** exp (2 ** 10 = 1024)", async () => {
    expect(await contract.contract.power(2, 10)).toBe(1024n);
  });

  it("should compute 10 ** decimals for token scaling", async () => {
    expect(await contract.contract.scale(18)).toBe(10n ** 18n);
  });

  it("should desugar **= and update state (2 **= 3 = 8)", async () => {
    expect(await contract.contract.getValue()).toBe(2n);
    await contract.contract.powerAssign(3);
    expect(await contract.contract.getValue()).toBe(8n);
  });
});

describe("behavioral: readonly arrays", () => {
  let contract: DeployedContract;

  beforeAll(async () => {
    const deployer = await env.accounts[0].getAddress();
    contract = await compileAndDeploy(env, READONLY_ARRAY_SOURCE, "AdminRegistry", [deployer]);
  });

  it("should return readonly array via getter", async () => {
    const deployer = await env.accounts[0].getAddress();
    const admins = await contract.contract.getAdmins();
    expect(admins).toHaveLength(1);
    expect(admins[0]).toBe(deployer);
  });

  it("should return admin count", async () => {
    expect(await contract.contract.getAdminCount()).toBe(1n);
  });
});
