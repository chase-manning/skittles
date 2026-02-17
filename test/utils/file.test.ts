import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  findTypeScriptFiles,
  readFile,
  writeFile,
  removeDirectory,
  ensureDirectory,
} from "../../src/utils/file";

const TEST_DIR = path.join(__dirname, "__test_tmp__");

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

describe("findTypeScriptFiles", () => {
  it("should find .ts files in a directory", () => {
    fs.writeFileSync(path.join(TEST_DIR, "a.ts"), "const a = 1;");
    fs.writeFileSync(path.join(TEST_DIR, "b.ts"), "const b = 2;");
    fs.writeFileSync(path.join(TEST_DIR, "c.js"), "const c = 3;");

    const files = findTypeScriptFiles(TEST_DIR);
    expect(files).toHaveLength(2);
    expect(files.every((f) => f.endsWith(".ts"))).toBe(true);
  });

  it("should find .ts files recursively", () => {
    const subDir = path.join(TEST_DIR, "sub");
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(TEST_DIR, "a.ts"), "const a = 1;");
    fs.writeFileSync(path.join(subDir, "b.ts"), "const b = 2;");

    const files = findTypeScriptFiles(TEST_DIR);
    expect(files).toHaveLength(2);
  });

  it("should exclude .d.ts files", () => {
    fs.writeFileSync(path.join(TEST_DIR, "types.d.ts"), "declare const x: number;");
    fs.writeFileSync(path.join(TEST_DIR, "real.ts"), "const x = 1;");

    const files = findTypeScriptFiles(TEST_DIR);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("real.ts");
  });

  it("should return empty array for nonexistent directory", () => {
    const files = findTypeScriptFiles("/nonexistent/path");
    expect(files).toHaveLength(0);
  });
});

describe("readFile", () => {
  it("should read file contents", () => {
    const content = "hello world";
    fs.writeFileSync(path.join(TEST_DIR, "test.txt"), content);

    const result = readFile(path.join(TEST_DIR, "test.txt"));
    expect(result).toBe(content);
  });
});

describe("writeFile", () => {
  it("should write content to a file", () => {
    const filePath = path.join(TEST_DIR, "output.txt");
    writeFile(filePath, "test content");

    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("test content");
  });

  it("should create intermediate directories", () => {
    const filePath = path.join(TEST_DIR, "deep", "nested", "file.txt");
    writeFile(filePath, "deep content");

    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("deep content");
  });
});

describe("removeDirectory", () => {
  it("should remove a directory and contents", () => {
    const subDir = path.join(TEST_DIR, "toRemove");
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, "file.txt"), "data");

    removeDirectory(subDir);
    expect(fs.existsSync(subDir)).toBe(false);
  });

  it("should not throw for nonexistent directory", () => {
    expect(() => removeDirectory("/nonexistent/path")).not.toThrow();
  });
});

describe("ensureDirectory", () => {
  it("should create directory if it does not exist", () => {
    const dir = path.join(TEST_DIR, "newdir");
    ensureDirectory(dir);
    expect(fs.existsSync(dir)).toBe(true);
  });

  it("should not throw if directory already exists", () => {
    ensureDirectory(TEST_DIR);
    expect(fs.existsSync(TEST_DIR)).toBe(true);
  });
});
