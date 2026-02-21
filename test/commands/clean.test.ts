import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { cleanCommand } from "../../src/commands/clean";

const TEST_DIR = path.join(__dirname, "__test_tmp_clean__");

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

describe("cleanCommand", () => {
  it("should remove the default output directory", async () => {
    const outputDir = path.join(TEST_DIR, "artifacts");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "artifact.json"), "{}");

    await cleanCommand(TEST_DIR);

    expect(fs.existsSync(outputDir)).toBe(false);
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
});
