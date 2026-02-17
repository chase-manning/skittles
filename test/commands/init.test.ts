import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { initCommand } from "../../src/commands/init";

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

  it("should create .gitignore if it does not exist", async () => {
    await initCommand(TEST_DIR);
    const gitignorePath = path.join(TEST_DIR, ".gitignore");
    expect(fs.existsSync(gitignorePath)).toBe(true);

    const content = fs.readFileSync(gitignorePath, "utf-8");
    expect(content).toContain("build/");
    expect(content).toContain("dist/");
    expect(content).toContain("node_modules/");
  });
});
