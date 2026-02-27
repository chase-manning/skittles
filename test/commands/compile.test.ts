import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { compileCommand, watchCompile } from "../../src/commands/compile";

const TEST_DIR = path.join(__dirname, "__test_tmp_compile__");

const SIMPLE_CONTRACT = `export class Counter {
  count: number = 0;
  increment(): void {
    this.count += 1;
  }
}`;

const MODIFIED_CONTRACT = `export class Counter {
  count: number = 0;
  increment(): void {
    this.count += 2;
  }
}`;

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

describe("compileCommand", () => {
  it("should compile contracts successfully", async () => {
    const contractsDir = path.join(TEST_DIR, "contracts");
    fs.mkdirSync(contractsDir, { recursive: true });
    fs.writeFileSync(path.join(contractsDir, "Counter.ts"), SIMPLE_CONTRACT);

    // Mock process.exit to prevent test from exiting
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await compileCommand(TEST_DIR);

    const solDir = path.join(TEST_DIR, "artifacts", "solidity");
    expect(fs.existsSync(path.join(solDir, "Counter.sol"))).toBe(true);

    exitSpy.mockRestore();
  });
});

describe("watchCompile", () => {
  it("should recompile when a file changes in watch mode", async () => {
    const contractsDir = path.join(TEST_DIR, "contracts");
    fs.mkdirSync(contractsDir, { recursive: true });
    fs.writeFileSync(path.join(contractsDir, "Counter.ts"), SIMPLE_CONTRACT);

    // Start watch mode (returns after initial compile and starting watcher)
    const cleanup = await watchCompile(TEST_DIR);

    try {
      // Verify initial compilation produced output
      const solDir = path.join(TEST_DIR, "artifacts", "solidity");
      expect(fs.existsSync(path.join(solDir, "Counter.sol"))).toBe(true);

      const initialSol = fs.readFileSync(path.join(solDir, "Counter.sol"), "utf-8");

      // Modify the contract file to trigger recompilation
      fs.writeFileSync(path.join(contractsDir, "Counter.ts"), MODIFIED_CONTRACT);

      // Wait for debounce (200ms) + compilation time
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const updatedSol = fs.readFileSync(path.join(solDir, "Counter.sol"), "utf-8");
      expect(updatedSol).not.toBe(initialSol);
      expect(updatedSol).toContain("count += 2");
    } finally {
      cleanup();
    }
  });

  it("should ignore non-TypeScript file changes", async () => {
    const contractsDir = path.join(TEST_DIR, "contracts");
    fs.mkdirSync(contractsDir, { recursive: true });
    fs.writeFileSync(path.join(contractsDir, "Counter.ts"), SIMPLE_CONTRACT);

    const cleanup = await watchCompile(TEST_DIR);

    try {
      const solDir = path.join(TEST_DIR, "artifacts", "solidity");
      const initialSol = fs.readFileSync(path.join(solDir, "Counter.sol"), "utf-8");

      // Write a non-ts file
      fs.writeFileSync(path.join(contractsDir, "notes.txt"), "some notes");

      // Wait for debounce period
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Solidity output should remain unchanged
      const afterSol = fs.readFileSync(path.join(solDir, "Counter.sol"), "utf-8");
      expect(afterSol).toBe(initialSol);
    } finally {
      cleanup();
    }
  });
});
