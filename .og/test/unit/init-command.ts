import { expect } from "chai";
import fs from "fs";
import path from "path";
import { initSkittles } from "../../src/commands/init";

describe("Init Command", () => {
  const testDir = path.join(__dirname, "../../test-init-temp");
  const originalCwd = process.cwd();

  /**
   * Recursively removes a directory (compatible across Node versions).
   */
  const removeDirectory = (dir: string): void => {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        removeDirectory(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    }
    fs.rmdirSync(dir);
  };

  beforeEach(() => {
    // Create a temporary directory for each test
    if (fs.existsSync(testDir)) {
      removeDirectory(testDir);
    }
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    // Clean up and restore original directory
    process.chdir(originalCwd);
    if (fs.existsSync(testDir)) {
      removeDirectory(testDir);
    }
  });

  describe("initSkittles", () => {
    it("should create skittles.config.ts with default settings", () => {
      initSkittles({});

      const configPath = path.join(testDir, "skittles.config.ts");
      expect(fs.existsSync(configPath)).to.be.true;

      const configContent = fs.readFileSync(configPath, "utf8");
      expect(configContent).to.include("SkittlesConfig");
      expect(configContent).to.include("enabled: true");
      expect(configContent).to.include("runs: 200");
    });

    it("should create contracts directory", () => {
      initSkittles({});

      const contractsDir = path.join(testDir, "contracts");
      expect(fs.existsSync(contractsDir)).to.be.true;
      expect(fs.statSync(contractsDir).isDirectory()).to.be.true;
    });

    it("should create IERC20 interface", () => {
      initSkittles({});

      const ierc20Path = path.join(testDir, "contracts", "ierc20.ts");
      expect(fs.existsSync(ierc20Path)).to.be.true;

      const ierc20Content = fs.readFileSync(ierc20Path, "utf8");
      expect(ierc20Content).to.include("export default interface IERC20");
      expect(ierc20Content).to.include("export interface TransferEvent");
      expect(ierc20Content).to.include("export interface ApprovalEvent");
    });

    it("should create ERC20 contract that implements IERC20", () => {
      initSkittles({});

      const contractPath = path.join(testDir, "contracts", "erc20.ts");
      expect(fs.existsSync(contractPath)).to.be.true;

      const contractContent = fs.readFileSync(contractPath, "utf8");
      expect(contractContent).to.include("export class ERC20 implements IERC20");
      expect(contractContent).to.include("import IERC20");
      expect(contractContent).to.include('from "./ierc20"');
      expect(contractContent).to.include("transfer");
      expect(contractContent).to.include("approve");
      expect(contractContent).to.include("Transfer: SkittlesEvent");
    });

    it("should create .gitignore with Skittles entries", () => {
      initSkittles({});

      const gitignorePath = path.join(testDir, ".gitignore");
      expect(fs.existsSync(gitignorePath)).to.be.true;

      const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
      expect(gitignoreContent).to.include("# Skittles build artifacts");
      expect(gitignoreContent).to.include("build/");
      expect(gitignoreContent).to.include("*.abi");
      expect(gitignoreContent).to.include("*.bytecode");
      expect(gitignoreContent).to.include("*.yul");
    });

    it("should append to existing .gitignore without duplicating", () => {
      const existingContent = "node_modules/\n*.log\n";
      fs.writeFileSync(path.join(testDir, ".gitignore"), existingContent);

      initSkittles({});

      const gitignoreContent = fs.readFileSync(path.join(testDir, ".gitignore"), "utf8");
      expect(gitignoreContent).to.include(existingContent.trim());
      expect(gitignoreContent).to.include("# Skittles build artifacts");
      // Should only appear once
      const count = (gitignoreContent.match(/# Skittles build artifacts/g) || []).length;
      expect(count).to.equal(1);
    });

    it("should update package.json with compile and clean scripts", () => {
      const packageJson = {
        name: "test-project",
        version: "1.0.0",
        scripts: {},
      };
      fs.writeFileSync(path.join(testDir, "package.json"), JSON.stringify(packageJson, null, 2));

      initSkittles({});

      const updatedPackageJson = JSON.parse(
        fs.readFileSync(path.join(testDir, "package.json"), "utf8")
      );
      expect(updatedPackageJson.scripts.compile).to.equal("skittles compile");
      expect(updatedPackageJson.scripts.clean).to.equal("skittles clean");
    });

    it("should not overwrite existing scripts in package.json", () => {
      const packageJson = {
        name: "test-project",
        version: "1.0.0",
        scripts: {
          compile: "custom compile",
          clean: "custom clean",
          test: "mocha",
        },
      };
      fs.writeFileSync(path.join(testDir, "package.json"), JSON.stringify(packageJson, null, 2));

      initSkittles({});

      const updatedPackageJson = JSON.parse(
        fs.readFileSync(path.join(testDir, "package.json"), "utf8")
      );
      expect(updatedPackageJson.scripts.compile).to.equal("custom compile");
      expect(updatedPackageJson.scripts.clean).to.equal("custom clean");
      expect(updatedPackageJson.scripts.test).to.equal("mocha");
    });

    it("should skip package.json update if file does not exist", () => {
      initSkittles({});

      const packageJsonPath = path.join(testDir, "package.json");
      expect(fs.existsSync(packageJsonPath)).to.be.false;
    });

    it("should not overwrite skittles.config.ts if it exists and force is not set", () => {
      fs.writeFileSync(path.join(testDir, "skittles.config.ts"), "existing config");

      // Should not throw, but should exit early
      initSkittles({});

      // Verify the file wasn't overwritten
      const configContent = fs.readFileSync(path.join(testDir, "skittles.config.ts"), "utf8");
      expect(configContent).to.equal("existing config");
    });

    it("should overwrite skittles.config.ts when force is true", () => {
      fs.writeFileSync(path.join(testDir, "skittles.config.ts"), "existing config");

      initSkittles({ force: true });

      const configContent = fs.readFileSync(path.join(testDir, "skittles.config.ts"), "utf8");
      expect(configContent).to.include("SkittlesConfig");
      expect(configContent).to.not.equal("existing config");
    });

    it("should throw error if ierc20.ts exists and force is not set", () => {
      fs.mkdirSync(path.join(testDir, "contracts"), { recursive: true });
      fs.writeFileSync(path.join(testDir, "contracts", "ierc20.ts"), "existing interface");

      expect(() => {
        initSkittles({});
      }).to.throw("Contract file ierc20.ts already exists");
    });

    it("should throw error if erc20.ts exists and force is not set", () => {
      fs.mkdirSync(path.join(testDir, "contracts"), { recursive: true });
      fs.writeFileSync(path.join(testDir, "contracts", "erc20.ts"), "existing contract");

      expect(() => {
        initSkittles({});
      }).to.throw("Contract file erc20.ts already exists");
    });

    it("should overwrite contract files when force is true", () => {
      fs.mkdirSync(path.join(testDir, "contracts"), { recursive: true });
      fs.writeFileSync(path.join(testDir, "contracts", "ierc20.ts"), "existing interface");
      fs.writeFileSync(path.join(testDir, "contracts", "erc20.ts"), "existing contract");

      initSkittles({ force: true });

      const ierc20Content = fs.readFileSync(path.join(testDir, "contracts", "ierc20.ts"), "utf8");
      expect(ierc20Content).to.include("export default interface IERC20");
      expect(ierc20Content).to.not.equal("existing interface");

      const erc20Content = fs.readFileSync(path.join(testDir, "contracts", "erc20.ts"), "utf8");
      expect(erc20Content).to.include("export class ERC20");
      expect(erc20Content).to.not.equal("existing contract");
    });

    it("should create all required files in a single run", () => {
      initSkittles({});

      expect(fs.existsSync(path.join(testDir, "skittles.config.ts"))).to.be.true;
      expect(fs.existsSync(path.join(testDir, "contracts"))).to.be.true;
      expect(fs.existsSync(path.join(testDir, "contracts", "ierc20.ts"))).to.be.true;
      expect(fs.existsSync(path.join(testDir, "contracts", "erc20.ts"))).to.be.true;
      expect(fs.existsSync(path.join(testDir, ".gitignore"))).to.be.true;
    });
  });
});
