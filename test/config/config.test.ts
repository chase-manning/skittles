import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { loadConfig, DEFAULT_CONFIG } from "../../src/config/config";

const TEST_DIR = path.join(__dirname, "__test_tmp_config__");

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

describe("loadConfig", () => {
  it("should return defaults when no config file exists", async () => {
    const config = await loadConfig(TEST_DIR);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("should load from skittles.config.json", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      JSON.stringify({ outputDir: "dist", optimizer: { enabled: true } })
    );

    const config = await loadConfig(TEST_DIR);
    expect(config.outputDir).toBe("dist");
    expect(config.optimizer.enabled).toBe(true);
    expect(config.optimizer.runs).toBe(200);
    expect(config.contractsDir).toBe("contracts");
  });

  it("should merge partial config with defaults", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      JSON.stringify({ typeCheck: false })
    );

    const config = await loadConfig(TEST_DIR);
    expect(config.typeCheck).toBe(false);
    expect(config.contractsDir).toBe("contracts");
    expect(config.outputDir).toBe("build");
  });

  it("should throw on malformed JSON config", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      "not valid json{{"
    );

    await expect(loadConfig(TEST_DIR)).rejects.toThrow(
      "Failed to load config"
    );
  });
});
