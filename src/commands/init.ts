import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { writeFile, ensureDirectory } from "../utils/file.ts";
import { logSuccess, logError, logInfo, logWarning } from "../utils/console.ts";

const CONFIG_TEMPLATE = JSON.stringify(
  {
    typeCheck: true,
    consoleLog: true,
    contractsDir: "contracts",
    outputDir: "artifacts",
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
    exclude: ["node_modules", "artifacts", "cache", "dist"],
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
    sources: "./artifacts/solidity",
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

const EXAMPLE_CONTRACT = `import { address, msg } from "skittles";
import { ERC20 } from "skittles/contracts";

export class Token extends ERC20 {
  private _owner: address;

  constructor(initialSupply: number) {
    super("MyToken", "MTK");
    this._owner = msg.sender;
    this._mint(msg.sender, initialSupply);
  }

  public mint(to: address, amount: number): void {
    if (msg.sender != this._owner) {
      throw new Error("Caller is not the owner");
    }
    this._mint(to, amount);
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

  it("assigns initial supply to deployer", async function () {
    const { token, owner } = await networkHelpers.loadFixture(deployTokenFixture);
    expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
  });

  it("emits Transfer event when transferring tokens", async function () {
    const { token, owner, alice } = await networkHelpers.loadFixture(deployTokenFixture);
    const amount = 100n;

    await expect(token.transfer(alice.address, amount))
      .to.emit(token, "Transfer")
      .withArgs(owner.address, alice.address, amount);
  });

  it("allows owner to mint new tokens", async function () {
    const { token, alice } = await networkHelpers.loadFixture(deployTokenFixture);
    const mintAmount = 500n;
    await (await token.mint(alice.address, mintAmount)).wait();
    expect(await token.balanceOf(alice.address)).to.equal(mintAmount);
  });
});
`;

/**
 * Shared dependency and script definitions used by both buildPackageJson
 * and the existing package.json merge logic.
 */
const DEFAULT_SCRIPTS: Record<string, string> = {
  compile: "skittles compile",
  build: "skittles compile && hardhat build",
  clean: "skittles clean",
  test: "skittles compile && hardhat test",
};

const REQUIRED_DEV_DEPS: Record<string, string> = {
  "@nomicfoundation/hardhat-ethers": "^4.0.0",
  "@nomicfoundation/hardhat-ethers-chai-matchers": "^3.0.0",
  "@nomicfoundation/hardhat-mocha": "^3.0.0",
  "@nomicfoundation/hardhat-network-helpers": "^3.0.0",
  "@nomicfoundation/hardhat-typechain": "^3.0.0",
  chai: "^5.1.2",
  ethers: "^6.16.0",
  hardhat: "^3.0.0",
  mocha: "^11.0.0",
  "@types/mocha": "^10.0.0",
};

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
      scripts: { ...DEFAULT_SCRIPTS },
      dependencies: {
        skittles: "latest",
      },
      devDependencies: { ...REQUIRED_DEV_DEPS },
      engines: {
        node: ">=22.0.0",
      },
    },
    null,
    2
  );
}

/**
 * Write a file if it does not already exist, logging the result.
 * If the file exists, a warning is logged. Otherwise the file is written
 * and a success message is logged.
 */
function writeIfNotExists(
  filePath: string,
  content: string,
  description: string
): void {
  if (fs.existsSync(filePath)) {
    logWarning(`${description} already exists, skipping`);
  } else {
    writeFile(filePath, content);
    logSuccess(`Created ${description}`);
  }
}

/**
 * Create or update package.json with required dependencies and scripts.
 */
function initPackageJson(projectRoot: string): void {
  const projectName = path.basename(projectRoot);
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
      for (const [dep, version] of Object.entries(REQUIRED_DEV_DEPS)) {
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
      for (const [name, cmd] of Object.entries(DEFAULT_SCRIPTS)) {
        if (!pkg.scripts[name]) {
          pkg.scripts[name] = cmd;
          updated = true;
        }
      }
      if (updated) {
        writeFile(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");
        logSuccess("Updated package.json");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logWarning(
        `Could not update existing package.json (${message}), creating a new one`
      );
      writeFile(packageJsonPath, buildPackageJson(projectName) + "\n");
      logSuccess("Created package.json");
    }
  } else {
    writeFile(packageJsonPath, buildPackageJson(projectName) + "\n");
    logSuccess("Created package.json");
  }
}

/**
 * Create project directories and scaffold example files.
 */
function initProjectFiles(projectRoot: string): void {
  // Create directories
  const contractsDir = path.join(projectRoot, "contracts");
  ensureDirectory(contractsDir);
  logSuccess("Created contracts/ directory");

  const testDir = path.join(projectRoot, "test");
  ensureDirectory(testDir);
  logSuccess("Created test/ directory");

  // Write example contract
  writeIfNotExists(
    path.join(contractsDir, "Token.ts"),
    EXAMPLE_CONTRACT,
    "contracts/Token.ts"
  );

  // Write example test
  writeIfNotExists(
    path.join(testDir, "Token.test.ts"),
    EXAMPLE_TEST,
    "test/Token.test.ts"
  );

  // Write tsconfig.json
  writeIfNotExists(
    path.join(projectRoot, "tsconfig.json"),
    TSCONFIG_TEMPLATE + "\n",
    "tsconfig.json"
  );

  // Write hardhat.config.ts
  writeIfNotExists(
    path.join(projectRoot, "hardhat.config.ts"),
    HARDHAT_CONFIG_TEMPLATE,
    "hardhat.config.ts"
  );

  // Update .gitignore
  const gitignorePath = path.join(projectRoot, ".gitignore");
  const gitignoreEntries = [
    "dist/",
    "types/",
    "node_modules/",
    "artifacts/",
    "cache/",
    "coverage/",
    "typechain-types/",
  ];

  if (fs.existsSync(gitignorePath)) {
    const existing = fs.readFileSync(gitignorePath, "utf-8");
    const toAdd = gitignoreEntries.filter((entry) => !existing.includes(entry));
    if (toAdd.length > 0) {
      fs.appendFileSync(gitignorePath, "\n" + toAdd.join("\n") + "\n");
      logSuccess("Updated .gitignore");
    }
  } else {
    writeFile(gitignorePath, gitignoreEntries.join("\n") + "\n");
    logSuccess("Created .gitignore");
  }
}

/**
 * Write the skittles.config.json file.
 */
function initConfig(projectRoot: string): void {
  writeIfNotExists(
    path.join(projectRoot, "skittles.config.json"),
    CONFIG_TEMPLATE + "\n",
    "skittles.config.json"
  );
}

/**
 * Install project dependencies using the detected package manager.
 */
function installDependencies(
  projectRoot: string,
  install: boolean
): void {
  const pm = detectPackageManager(projectRoot);
  if (install) {
    logInfo(`Installing dependencies with ${pm}...`);
    try {
      execSync(`${pm} install`, {
        cwd: projectRoot,
        stdio: "pipe",
      });
      logSuccess("Dependencies installed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logError(`Failed to install dependencies: ${message}`);
      logInfo(`  You can install manually by running: ${pm} install`);
    }
  } else {
    logInfo(
      `Skipping dependency installation. Run \`${pm} install\` manually.`
    );
  }
}

export interface InitOptions {
  install?: boolean;
}

export async function initCommand(
  projectRoot: string,
  options: InitOptions = {}
): Promise<void> {
  const { install = true } = options;
  logInfo("Initializing new Skittles project...");

  initPackageJson(projectRoot);
  initProjectFiles(projectRoot);
  initConfig(projectRoot);
  installDependencies(projectRoot, install);

  logSuccess("Skittles project initialized!");
  logInfo("");
  logInfo("Next steps:");
  logInfo("  Compile and test:");
  logInfo("     npm run test");
}
