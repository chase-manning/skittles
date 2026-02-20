import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { initCommand } from "../../src/commands/init";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

const TEST_DIR = path.join(__dirname, "__test_tmp_init__");

beforeEach(() => {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("initCommand", () => {
  it("should create contracts directory", async () => {
    await initCommand(TEST_DIR);
    expect(fs.existsSync(path.join(TEST_DIR, "contracts"))).toBe(true);
  });

  it("should create skittles.config.json", async () => {
    await initCommand(TEST_DIR);
    const configPath = path.join(TEST_DIR, "skittles.config.json");
    expect(fs.existsSync(configPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(config.contractsDir).toBe("contracts");
    expect(config.outputDir).toBe("build");
  });

  it("should create example Token contract", async () => {
    await initCommand(TEST_DIR);
    expect(
      fs.existsSync(path.join(TEST_DIR, "contracts", "Token.ts"))
    ).toBe(true);
  });

  it("should not overwrite existing config", async () => {
    const configPath = path.join(TEST_DIR, "skittles.config.json");
    fs.writeFileSync(configPath, '{"custom": true}');

    await initCommand(TEST_DIR);

    const content = fs.readFileSync(configPath, "utf-8");
    expect(JSON.parse(content).custom).toBe(true);
  });

  it("should create tsconfig.json", async () => {
    await initCommand(TEST_DIR);
    const tsconfigPath = path.join(TEST_DIR, "tsconfig.json");
    expect(fs.existsSync(tsconfigPath)).toBe(true);

    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.strictPropertyInitialization).toBe(false);
    expect(tsconfig.compilerOptions.noUncheckedIndexedAccess).toBe(false);
  });

  it("should not overwrite existing tsconfig.json", async () => {
    const tsconfigPath = path.join(TEST_DIR, "tsconfig.json");
    fs.writeFileSync(tsconfigPath, '{"custom": true}');

    await initCommand(TEST_DIR);

    const content = fs.readFileSync(tsconfigPath, "utf-8");
    expect(JSON.parse(content).custom).toBe(true);
  });

  it("should create package.json with correct structure", async () => {
    await initCommand(TEST_DIR);
    const pkgPath = path.join(TEST_DIR, "package.json");
    expect(fs.existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies.skittles).toBeDefined();
    expect(pkg.devDependencies.ethers).toBeDefined();
    expect(pkg.devDependencies.hardhat).toBeDefined();
    expect(pkg.devDependencies.mocha).toBeDefined();
    expect(pkg.scripts.test).toBe("skittles compile && hardhat test");
    expect(pkg.scripts.build).toBe("skittles compile && hardhat build");
  });

  it("should update existing package.json with missing deps", async () => {
    const pkgPath = path.join(TEST_DIR, "package.json");
    fs.writeFileSync(
      pkgPath,
      JSON.stringify({ name: "existing", version: "2.0.0" }, null, 2)
    );

    await initCommand(TEST_DIR);

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    expect(pkg.name).toBe("existing");
    expect(pkg.version).toBe("2.0.0");
    expect(pkg.type).toBe("module");
    expect(pkg.devDependencies.hardhat).toBeDefined();
  });

  it("should create Token.test.ts with Hardhat testing pattern", async () => {
    await initCommand(TEST_DIR);
    const testPath = path.join(TEST_DIR, "test", "Token.test.ts");
    expect(fs.existsSync(testPath)).toBe(true);

    const content = fs.readFileSync(testPath, "utf-8");
    expect(content).toContain("network.connect()");
    expect(content).toContain("loadFixture");
    expect(content).toContain("to.emit");
    expect(content).toContain("revertedWith");
    expect(content).toContain("getContractAt");
    expect(content).not.toContain("skittles/testing");
  });

  it("should create hardhat.config.ts with plugins and paths.sources", async () => {
    await initCommand(TEST_DIR);
    const configPath = path.join(TEST_DIR, "hardhat.config.ts");
    expect(fs.existsSync(configPath)).toBe(true);

    const content = fs.readFileSync(configPath, "utf-8");
    expect(content).toContain("hardhat-ethers");
    expect(content).toContain("build/solidity");
  });

  it("should not create vitest.config.ts", async () => {
    await initCommand(TEST_DIR);
    expect(fs.existsSync(path.join(TEST_DIR, "vitest.config.ts"))).toBe(false);
  });

  it("should create .gitignore if it does not exist", async () => {
    await initCommand(TEST_DIR);
    const gitignorePath = path.join(TEST_DIR, ".gitignore");
    expect(fs.existsSync(gitignorePath)).toBe(true);

    const content = fs.readFileSync(gitignorePath, "utf-8");
    expect(content).toContain("build/");
    expect(content).toContain("dist/");
    expect(content).toContain("types/");
    expect(content).toContain("node_modules/");
    expect(content).toContain("artifacts/");
    expect(content).toContain("cache/");
    expect(content).toContain("coverage/");
    expect(content).toContain("typechain-types/");
  });

  it("should include types directory in tsconfig", async () => {
    await initCommand(TEST_DIR);
    const tsconfigPath = path.join(TEST_DIR, "tsconfig.json");
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
    expect(tsconfig.include).toContain("types/**/*");
  });

  it("should have devDependencies aligned with the example project", async () => {
    await initCommand(TEST_DIR);
    const initPkg = JSON.parse(
      fs.readFileSync(path.join(TEST_DIR, "package.json"), "utf-8")
    );
    const examplePkg = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "..", "example", "package.json"),
        "utf-8"
      )
    );

    const initDeps = initPkg.devDependencies;
    const exampleDeps = examplePkg.devDependencies;

    for (const dep of Object.keys(exampleDeps)) {
      expect(initDeps[dep], `${dep} missing from init template`).toBeDefined();
      expect(initDeps[dep], `${dep} version mismatch`).toBe(exampleDeps[dep]);
    }
    for (const dep of Object.keys(initDeps)) {
      expect(exampleDeps[dep], `${dep} in init template but missing from example`).toBeDefined();
    }
  });
});
