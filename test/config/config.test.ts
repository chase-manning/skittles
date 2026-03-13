import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { loadConfig, DEFAULT_CONFIG } from "../../src/config/config";
import { useTempDir } from "../fixtures";

const TEST_DIR = useTempDir(__dirname, "__test_tmp_config__");

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
    expect(config.outputDir).toBe("artifacts");
    expect(config.consoleLog).toBe(false);
  });

  it("should load consoleLog config option", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      JSON.stringify({ consoleLog: true })
    );

    const config = await loadConfig(TEST_DIR);
    expect(config.consoleLog).toBe(true);
  });

  it("should throw on malformed JSON config", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      "not valid json{{"
    );

    await expect(loadConfig(TEST_DIR)).rejects.toThrow(
      "Failed to parse skittles.config.json"
    );
  });

  it("should throw when config is not an object", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      JSON.stringify("not an object")
    );

    await expect(loadConfig(TEST_DIR)).rejects.toThrow("Config must be an object");
  });

  it("should throw when config is an array", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      JSON.stringify([1, 2, 3])
    );

    await expect(loadConfig(TEST_DIR)).rejects.toThrow("Config must be an object");
  });

  it("should throw when typeCheck is not a boolean", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      JSON.stringify({ typeCheck: "yes" })
    );

    await expect(loadConfig(TEST_DIR)).rejects.toThrow(
      '"typeCheck" must be a boolean'
    );
  });

  it("should throw when optimizer is not an object", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      JSON.stringify({ optimizer: "yes" })
    );

    await expect(loadConfig(TEST_DIR)).rejects.toThrow(
      '"optimizer" must be an object'
    );
  });

  it("should throw when optimizer.runs is not a number", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      JSON.stringify({ optimizer: { runs: "fast" } })
    );

    await expect(loadConfig(TEST_DIR)).rejects.toThrow(
      '"optimizer.runs" must be a number'
    );
  });

  it("should throw when contractsDir is not a string", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      JSON.stringify({ contractsDir: 123 })
    );

    await expect(loadConfig(TEST_DIR)).rejects.toThrow(
      '"contractsDir" must be a string'
    );
  });

  it("should throw when solidity is not an object", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      JSON.stringify({ solidity: "latest" })
    );

    await expect(loadConfig(TEST_DIR)).rejects.toThrow(
      '"solidity" must be an object'
    );
  });

  it("should throw when solidity.version is not a string", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      JSON.stringify({ solidity: { version: 8 } })
    );

    await expect(loadConfig(TEST_DIR)).rejects.toThrow(
      '"solidity.version" must be a string'
    );
  });

  it("should load solidity version and license from config", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      JSON.stringify({ solidity: { version: "^0.8.24", license: "GPL-3.0" } })
    );

    const config = await loadConfig(TEST_DIR);
    expect(config.solidity.version).toBe("^0.8.24");
    expect(config.solidity.license).toBe("GPL-3.0");
  });

  it("should use default solidity config when not specified", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      JSON.stringify({ typeCheck: false })
    );

    const config = await loadConfig(TEST_DIR);
    expect(config.solidity.version).toBe("^0.8.20");
    expect(config.solidity.license).toBe("MIT");
  });

  it("should merge partial solidity config with defaults", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      JSON.stringify({ solidity: { version: "^0.8.26" } })
    );

    const config = await loadConfig(TEST_DIR);
    expect(config.solidity.version).toBe("^0.8.26");
    expect(config.solidity.license).toBe("MIT");
  });
});
