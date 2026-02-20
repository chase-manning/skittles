import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { writeFile, ensureDirectory } from "../utils/file.ts";
import { logSuccess, logError, logInfo, logWarning } from "../utils/console.ts";

const CONFIG_TEMPLATE = JSON.stringify(
  {
    typeCheck: true,
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
      module: "nodenext",
      moduleResolution: "nodenext",
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
    include: ["contracts/**/*", "test/**/*", "types/**/*"],
    exclude: ["node_modules", "build", "dist"],
  },
  null,
  2
);

const HARDHAT_CONFIG_TEMPLATE = `import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatTypechain from "@nomicfoundation/hardhat-typechain";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";

export default defineConfig({
  plugins: [
    hardhatEthers,
    hardhatTypechain,
    hardhatMocha,
    hardhatEthersChaiMatchers,
    hardhatNetworkHelpers,
  ],
  paths: {
    sources: "./build/solidity",
    tests: "./test",
  },
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: false, runs: 200 },
    },
  },
});
`;

const EXAMPLE_CONTRACT = `import { address, msg, SkittlesEvent, Indexed } from "skittles";

export class Token {
  Transfer: SkittlesEvent<{
    from: Indexed<address>;
    to: Indexed<address>;
    value: number;
  }>;

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
    this.Transfer.emit(sender, to, amount);
    return true;
  }
}
`;

const EXAMPLE_TEST = `import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-ethers-chai-matchers";
import "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers, networkHelpers } = await hre.network.connect();
const INITIAL_SUPPLY = 1_000_000n;

describe("Token", function () {
  async function deployTokenFixture() {
    const token = await ethers.deployContract("Token", [INITIAL_SUPPLY]);
    const [owner, alice, bob] = await ethers.getSigners();
    const addr = await token.getAddress();
    const tokenAsAlice = await ethers.getContractAt("Token", addr, alice);
    return { token, tokenAsAlice, owner, alice, bob };
  }

  it("has the correct name", async function () {
    const { token } = await networkHelpers.loadFixture(deployTokenFixture);
    expect(await token.name()).to.equal("MyToken");
  });

  it("emits Transfer event when transferring tokens", async function () {
    const { token, owner, alice } = await networkHelpers.loadFixture(deployTokenFixture);
    const amount = 100n;

    await expect(token.transfer(alice.address, amount))
      .to.emit(token, "Transfer")
      .withArgs(owner.address, alice.address, amount);
  });

  it("reverts on insufficient balance", async function () {
    const { token, tokenAsAlice, bob } = await networkHelpers.loadFixture(deployTokenFixture);

    await expect(
      tokenAsAlice.transfer(bob.address, 999_999_999n)
    ).to.be.revertedWith("Insufficient balance");
  });
});
`;

/**
 * Detect which package manager is in use based on lock files.
 */
function detectPackageManager(projectRoot: string): "npm" | "yarn" | "pnpm" {
  if (fs.existsSync(path.join(projectRoot, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  return "npm";
}

/**
 * Build a package.json template for a new Skittles project.
 */
function buildPackageJson(projectName: string): string {
  return JSON.stringify(
    {
      name: projectName,
      version: "1.0.0",
      private: true,
      type: "module",
      scripts: {
        compile: "skittles compile",
        build: "skittles compile && hardhat build",
        clean: "skittles clean",
        test: "skittles compile && hardhat test",
      },
      dependencies: {
        skittles: "latest",
      },
      devDependencies: {
        "@nomicfoundation/hardhat-ethers": "^4.0.0",
        "@nomicfoundation/hardhat-ethers-chai-matchers": "^3.0.0",
        "@nomicfoundation/hardhat-mocha": "^3.0.0",
        "@nomicfoundation/hardhat-network-helpers": "^3.0.0",
        "@nomicfoundation/hardhat-typechain": "^3.0.0",
        chai: "^5.1.2",
        ethers: "^6.16.0",
        hardhat: "^3.0.0",
        mocha: "^10.0.0",
        "@types/mocha": "^10.0.0",
      },
      engines: {
        node: ">=22.0.0",
      },
    },
    null,
    2
  );
}

export async function initCommand(projectRoot: string): Promise<void> {
  logInfo("Initializing new Skittles project...");

  const projectName = path.basename(projectRoot);

  // Create package.json (or update existing)
  const packageJsonPath = path.join(projectRoot, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      let updated = false;
      if (pkg.type !== "module") {
        pkg.type = "module";
        updated = true;
      }
      if (!pkg.devDependencies) pkg.devDependencies = {};
      const requiredDevDeps: Record<string, string> = {
        "@nomicfoundation/hardhat-ethers": "^4.0.0",
        "@nomicfoundation/hardhat-ethers-chai-matchers": "^3.0.0",
        "@nomicfoundation/hardhat-mocha": "^3.0.0",
        "@nomicfoundation/hardhat-network-helpers": "^3.0.0",
        "@nomicfoundation/hardhat-typechain": "^3.0.0",
        chai: "^5.1.2",
        ethers: "^6.16.0",
        hardhat: "^3.0.0",
        mocha: "^10.0.0",
        "@types/mocha": "^10.0.0",
      };
      for (const [dep, version] of Object.entries(requiredDevDeps)) {
        if (!pkg.devDependencies[dep] && !pkg.dependencies?.[dep]) {
          pkg.devDependencies[dep] = version;
          updated = true;
        }
      }
      if (!pkg.dependencies) pkg.dependencies = {};
      if (!pkg.dependencies.skittles) {
        pkg.dependencies.skittles = "latest";
        updated = true;
      }
      if (!pkg.scripts) pkg.scripts = {};
      const defaultScripts: Record<string, string> = {
        compile: "skittles compile",
        build: "skittles compile && hardhat build",
        clean: "skittles clean",
        test: "skittles compile && hardhat test",
      };
      for (const [name, cmd] of Object.entries(defaultScripts)) {
        if (!pkg.scripts[name]) {
          pkg.scripts[name] = cmd;
          updated = true;
        }
      }
      if (updated) {
        writeFile(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");
        logSuccess("Updated package.json");
      }
    } catch {
      logWarning(
        "Could not update existing package.json, creating a new one"
      );
      writeFile(packageJsonPath, buildPackageJson(projectName) + "\n");
      logSuccess("Created package.json");
    }
  } else {
    writeFile(packageJsonPath, buildPackageJson(projectName) + "\n");
    logSuccess("Created package.json");
  }

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
  const gitignoreEntries = ["build/", "dist/", "types/", "node_modules/"];

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

  // Install dependencies
  const pm = detectPackageManager(projectRoot);
  logInfo(`Installing dependencies with ${pm}...`);
  try {
    execSync(`${pm} install`, {
      cwd: projectRoot,
      stdio: "pipe",
    });
    logSuccess("Dependencies installed");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    logError(`Failed to install dependencies: ${message}`);
    logInfo(`  You can install manually by running: ${pm} install`);
  }

  logSuccess("Skittles project initialized!");
  logInfo("");
  logInfo("Next steps:");
  logInfo("  Compile and test:");
  logInfo("     npm run test");
}
