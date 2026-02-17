import path from "path";
import fs from "fs";
import { writeFile, ensureDirectory } from "../utils/file";
import { logSuccess, logInfo, logWarning } from "../utils/console";

const CONFIG_TEMPLATE = JSON.stringify(
  {
    typeCheck: true,
    optimizer: {
      enabled: false,
      runs: 200,
    },
    contractsDir: "contracts",
    outputDir: "build",
  },
  null,
  2
);

const TSCONFIG_TEMPLATE = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      module: "commonjs",
      lib: ["ES2022"],
      strict: true,
      strictPropertyInitialization: false,
      noUncheckedIndexedAccess: false,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      outDir: "./dist",
      rootDir: ".",
    },
    include: ["contracts/**/*", "test/**/*"],
    exclude: ["node_modules", "build", "dist"],
  },
  null,
  2
);

const VITEST_CONFIG_TEMPLATE = `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 30000,
  },
});
`;

const HARDHAT_CONFIG_TEMPLATE = `import { defineConfig } from "hardhat/config";

export default defineConfig({});
`;

const EXAMPLE_CONTRACT = `import { address, msg } from "skittles";

export class Token {
  public name: string = "MyToken";
  public symbol: string = "MTK";
  public totalSupply: number = 0;
  private balances: Record<address, number> = {};

  constructor(initialSupply: number) {
    this.totalSupply = initialSupply;
    this.balances[msg.sender] = initialSupply;
  }

  public balanceOf(account: address): number {
    return this.balances[account];
  }

  public transfer(to: address, amount: number): boolean {
    const sender: address = msg.sender;
    if (this.balances[sender] < amount) {
      throw new Error("Insufficient balance");
    }
    this.balances[sender] -= amount;
    this.balances[to] += amount;
    return true;
  }
}
`;

const EXAMPLE_TEST = `import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestEnv, deploy, connectAs, TestEnv } from "skittles/testing";

const INITIAL_SUPPLY = 1_000_000n;

describe("Token", () => {
  let env: TestEnv;
  let token: any;

  beforeAll(async () => {
    env = await createTestEnv();
    token = await deploy(env, "Token", [INITIAL_SUPPLY]);
  });

  afterAll(async () => {
    await env.close();
  });

  it("has the correct name", async () => {
    expect(await token.name()).toBe("MyToken");
  });

  it("has the correct symbol", async () => {
    expect(await token.symbol()).toBe("MTK");
  });

  it("assigns initial supply to the deployer", async () => {
    const [deployer] = env.accounts;
    const balance = await token.balanceOf(await deployer.getAddress());
    expect(balance).toBe(INITIAL_SUPPLY);
  });

  it("transfers tokens between accounts", async () => {
    const [, alice] = env.accounts;
    const aliceAddr = await alice.getAddress();

    await token.transfer(aliceAddr, 100n);
    expect(await token.balanceOf(aliceAddr)).toBe(100n);
  });

  it("reverts on insufficient balance", async () => {
    const [, alice, bob] = env.accounts;
    const bobAddr = await bob.getAddress();
    const aliceToken = connectAs(token, alice);

    await expect(
      aliceToken.transfer(bobAddr, 999_999_999n)
    ).rejects.toThrow();
  });
});
`;

export async function initCommand(projectRoot: string): Promise<void> {
  logInfo("Initializing new Skittles project...");

  // Create contracts directory
  const contractsDir = path.join(projectRoot, "contracts");
  ensureDirectory(contractsDir);
  logSuccess("Created contracts/ directory");

  // Create test directory
  const testDir = path.join(projectRoot, "test");
  ensureDirectory(testDir);
  logSuccess("Created test/ directory");

  // Write config file
  const configPath = path.join(projectRoot, "skittles.config.json");
  if (fs.existsSync(configPath)) {
    logWarning("skittles.config.json already exists, skipping");
  } else {
    writeFile(configPath, CONFIG_TEMPLATE + "\n");
    logSuccess("Created skittles.config.json");
  }

  // Write example contract
  const examplePath = path.join(contractsDir, "Token.ts");
  if (fs.existsSync(examplePath)) {
    logWarning("contracts/Token.ts already exists, skipping");
  } else {
    writeFile(examplePath, EXAMPLE_CONTRACT);
    logSuccess("Created contracts/Token.ts");
  }

  // Write example test
  const exampleTestPath = path.join(testDir, "Token.test.ts");
  if (fs.existsSync(exampleTestPath)) {
    logWarning("test/Token.test.ts already exists, skipping");
  } else {
    writeFile(exampleTestPath, EXAMPLE_TEST);
    logSuccess("Created test/Token.test.ts");
  }

  // Write tsconfig.json
  const tsconfigPath = path.join(projectRoot, "tsconfig.json");
  if (fs.existsSync(tsconfigPath)) {
    logWarning("tsconfig.json already exists, skipping");
  } else {
    writeFile(tsconfigPath, TSCONFIG_TEMPLATE + "\n");
    logSuccess("Created tsconfig.json");
  }

  // Write vitest.config.ts
  const vitestConfigPath = path.join(projectRoot, "vitest.config.ts");
  if (fs.existsSync(vitestConfigPath)) {
    logWarning("vitest.config.ts already exists, skipping");
  } else {
    writeFile(vitestConfigPath, VITEST_CONFIG_TEMPLATE);
    logSuccess("Created vitest.config.ts");
  }

  // Write hardhat.config.ts
  const hardhatConfigPath = path.join(projectRoot, "hardhat.config.ts");
  if (fs.existsSync(hardhatConfigPath)) {
    logWarning("hardhat.config.ts already exists, skipping");
  } else {
    writeFile(hardhatConfigPath, HARDHAT_CONFIG_TEMPLATE);
    logSuccess("Created hardhat.config.ts");
  }

  // Update .gitignore
  const gitignorePath = path.join(projectRoot, ".gitignore");
  const gitignoreEntries = ["build/", "dist/", "node_modules/"];

  if (fs.existsSync(gitignorePath)) {
    const existing = fs.readFileSync(gitignorePath, "utf-8");
    const toAdd = gitignoreEntries.filter(
      (entry) => !existing.includes(entry)
    );
    if (toAdd.length > 0) {
      fs.appendFileSync(gitignorePath, "\n" + toAdd.join("\n") + "\n");
      logSuccess("Updated .gitignore");
    }
  } else {
    writeFile(gitignorePath, gitignoreEntries.join("\n") + "\n");
    logSuccess("Created .gitignore");
  }

  logSuccess("Skittles project initialized!");
  logInfo("");
  logInfo("Next steps:");
  logInfo("  1. Install testing dependencies:");
  logInfo("     npm install --save-dev ethers hardhat vitest");
  logInfo("  2. Compile and test:");
  logInfo("     npx skittles test");
}
