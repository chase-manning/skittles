import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { cleanCommand } from "../../src/commands/clean";
import { useTempDir } from "../fixtures";

const TEST_DIR = useTempDir(__dirname, "__test_tmp_clean__");

describe("cleanCommand", () => {
  it("should remove the default output directory and cache directory", async () => {
    const outputDir = path.join(TEST_DIR, "artifacts");
    const cacheDir = path.join(TEST_DIR, "cache");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "artifact.json"), "{}");
    fs.writeFileSync(path.join(cacheDir, ".skittles-cache.json"), "{}");

    await cleanCommand(TEST_DIR);

    expect(fs.existsSync(outputDir)).toBe(false);
    expect(fs.existsSync(cacheDir)).toBe(false);
  });

  it("should not throw if output directory does not exist", async () => {
    await expect(cleanCommand(TEST_DIR)).resolves.not.toThrow();
  });

  it("should respect custom outputDir from config", async () => {
    const customDir = path.join(TEST_DIR, "custom_output");
    fs.mkdirSync(customDir, { recursive: true });
    fs.writeFileSync(path.join(customDir, "artifact.json"), "{}");

    const config = { outputDir: "custom_output" };
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      JSON.stringify(config)
    );

    await cleanCommand(TEST_DIR);

    expect(fs.existsSync(customDir)).toBe(false);
  });

  it("should log error and exit when config loading fails", async () => {
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Write invalid JSON config to trigger loadConfig failure
    fs.writeFileSync(
      path.join(TEST_DIR, "skittles.config.json"),
      "invalid json"
    );

    await cleanCommand(TEST_DIR);

    expect(errorSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
