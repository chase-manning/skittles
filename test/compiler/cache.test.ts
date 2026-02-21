import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { compile } from "../../src/compiler/compiler";
import type { SkittlesConfig } from "../../src/types";
import * as parserModule from "../../src/compiler/parser";

const pkgJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf-8")
);

const defaultConfig: Required<SkittlesConfig> = {
  typeCheck: true,
  optimizer: { enabled: false, runs: 200 },
  contractsDir: "contracts",
  outputDir: "build",
};

function createTempProject(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skittles-cache-test-"));
  fs.mkdirSync(path.join(tmpDir, "contracts"), { recursive: true });
  return tmpDir;
}

function writeContract(projectRoot: string, fileName: string, source: string): void {
  fs.writeFileSync(path.join(projectRoot, "contracts", fileName), source, "utf-8");
}

function removeTempProject(projectRoot: string): void {
  fs.rmSync(projectRoot, { recursive: true, force: true });
}

describe("incremental compilation cache", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = createTempProject();
  });

  afterEach(() => {
    removeTempProject(projectRoot);
    vi.restoreAllMocks();
  });

  it("should use cache on second compile when source is unchanged", async () => {
    writeContract(projectRoot, "Counter.ts", `
      class Counter {
        public count: number = 0;
        public increment(): void {
          this.count = this.count + 1;
        }
      }
    `);

    const result1 = await compile(projectRoot, defaultConfig);
    expect(result1.success).toBe(true);
    expect(result1.artifacts).toHaveLength(1);
    expect(result1.artifacts[0].contractName).toBe("Counter");

    const spy = vi.spyOn(parserModule, "parse");

    const result2 = await compile(projectRoot, defaultConfig);
    expect(result2.success).toBe(true);
    expect(result2.artifacts).toHaveLength(1);
    expect(result2.artifacts[0].contractName).toBe("Counter");

    expect(spy).not.toHaveBeenCalled();

    expect(result2.artifacts[0].solidity).toEqual(result1.artifacts[0].solidity);
  });

  it("should recompile when a contract file is modified", async () => {
    writeContract(projectRoot, "Counter.ts", `
      class Counter {
        public count: number = 0;
        public increment(): void {
          this.count = this.count + 1;
        }
      }
    `);

    const result1 = await compile(projectRoot, defaultConfig);
    expect(result1.success).toBe(true);
    expect(result1.artifacts).toHaveLength(1);

    const spy = vi.spyOn(parserModule, "parse");

    writeContract(projectRoot, "Counter.ts", `
      class Counter {
        public count: number = 0;
        public increment(): void {
          this.count = this.count + 2;
        }
      }
    `);

    const result2 = await compile(projectRoot, defaultConfig);
    expect(result2.success).toBe(true);
    expect(result2.artifacts).toHaveLength(1);
    expect(result2.artifacts[0].solidity).toContain("count + 2");

    expect(spy).toHaveBeenCalled();
  });

  it("should compile new file without recompiling unchanged files when no shared defs change", async () => {
    writeContract(projectRoot, "Counter.ts", `
      class Counter {
        public count: number = 0;
        public increment(): void {
          this.count = this.count + 1;
        }
      }
    `);

    const result1 = await compile(projectRoot, defaultConfig);
    expect(result1.success).toBe(true);
    expect(result1.artifacts).toHaveLength(1);

    const spy = vi.spyOn(parserModule, "parse");

    writeContract(projectRoot, "Token.ts", `
      class Token {
        public name: string = "Token";
      }
    `);

    const result2 = await compile(projectRoot, defaultConfig);
    expect(result2.success).toBe(true);
    expect(result2.artifacts).toHaveLength(2);

    expect(spy).toHaveBeenCalled();

    // Token.ts is new so generateSolidity must be called for it.
    // Counter.ts is unchanged and served from cache (no generateSolidity for Counter).
    const counterArtifact = result2.artifacts.find((a) => a.contractName === "Counter");
    expect(counterArtifact?.solidity).toEqual(result1.artifacts[0].solidity);
  });

  it("should only recompile the changed file when shared definitions are unchanged", async () => {
    writeContract(projectRoot, "Counter.ts", `
      class Counter {
        public count: number = 0;
        public increment(): void {
          this.count = this.count + 1;
        }
      }
    `);

    writeContract(projectRoot, "Token.ts", `
      class Token {
        public name: string = "Token";
      }
    `);

    const result1 = await compile(projectRoot, defaultConfig);
    expect(result1.success).toBe(true);
    expect(result1.artifacts).toHaveLength(2);

    const spy = vi.spyOn(parserModule, "parse");

    writeContract(projectRoot, "Token.ts", `
      class Token {
        public name: string = "UpdatedToken";
      }
    `);

    const result2 = await compile(projectRoot, defaultConfig);
    expect(result2.success).toBe(true);
    expect(result2.artifacts).toHaveLength(2);

    expect(spy).toHaveBeenCalled();

    // Counter.ts is unchanged and served from cache
    const counterArtifact = result2.artifacts.find((a) => a.contractName === "Counter");
    expect(counterArtifact?.solidity).toEqual(result1.artifacts.find((a) => a.contractName === "Counter")!.solidity);
  });

  it("should produce identical artifacts from cache as from fresh compilation", async () => {
    writeContract(projectRoot, "Math.ts", `
      class Math {
        public add(a: number, b: number): number {
          return a + b;
        }
        public mul(a: number, b: number): number {
          return a * b;
        }
      }
    `);

    const result1 = await compile(projectRoot, defaultConfig);
    expect(result1.success).toBe(true);

    const result2 = await compile(projectRoot, defaultConfig);
    expect(result2.success).toBe(true);

    expect(result2.artifacts).toHaveLength(result1.artifacts.length);
    for (let i = 0; i < result1.artifacts.length; i++) {
      expect(result2.artifacts[i].contractName).toEqual(result1.artifacts[i].contractName);
      expect(result2.artifacts[i].solidity).toEqual(result1.artifacts[i].solidity);
    }
  });

  it("should write cache file to the output directory", async () => {
    writeContract(projectRoot, "Simple.ts", `
      class Simple {
        public value: number = 0;
      }
    `);

    await compile(projectRoot, defaultConfig);

    const cachePath = path.join(projectRoot, "build", ".skittles-cache.json");
    expect(fs.existsSync(cachePath)).toBe(true);

    const cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    expect(cache.version).toBe("4");
    expect(cache.skittlesVersion).toBe(pkgJson.version);
    expect(Object.keys(cache.files).length).toBeGreaterThan(0);
  });

  it("should handle corrupted cache gracefully and recompile", async () => {
    writeContract(projectRoot, "Counter.ts", `
      class Counter {
        public count: number = 0;
      }
    `);

    await compile(projectRoot, defaultConfig);

    const cachePath = path.join(projectRoot, "build", ".skittles-cache.json");
    fs.writeFileSync(cachePath, "NOT VALID JSON {{{", "utf-8");

    const spy = vi.spyOn(parserModule, "parse");

    const result = await compile(projectRoot, defaultConfig);
    expect(result.success).toBe(true);
    expect(result.artifacts).toHaveLength(1);

    expect(spy).toHaveBeenCalled();
  });

  it("should handle missing cache file and compile fresh", async () => {
    writeContract(projectRoot, "Counter.ts", `
      class Counter {
        public count: number = 0;
      }
    `);

    const spy = vi.spyOn(parserModule, "parse");

    const result = await compile(projectRoot, defaultConfig);
    expect(result.success).toBe(true);
    expect(result.artifacts).toHaveLength(1);

    expect(spy).toHaveBeenCalled();
  });

  it("should use cache for multiple contracts in the same file", async () => {
    writeContract(projectRoot, "Multi.ts", `
      class Ownable {
        public owner: address;

        constructor() {
          this.owner = msg.sender;
        }
      }

      class Token extends Ownable {
        public totalSupply: number = 0;
      }
    `);

    const result1 = await compile(projectRoot, defaultConfig);
    expect(result1.success).toBe(true);
    expect(result1.artifacts.length).toBeGreaterThanOrEqual(1);

    const spy = vi.spyOn(parserModule, "parse");

    const result2 = await compile(projectRoot, defaultConfig);
    expect(result2.success).toBe(true);

    expect(spy).not.toHaveBeenCalled();

    expect(result2.artifacts.length).toEqual(result1.artifacts.length);
    for (let i = 0; i < result1.artifacts.length; i++) {
      expect(result2.artifacts[i].solidity).toEqual(result1.artifacts[i].solidity);
    }
  });

  it("should invalidate cache when skittles package version changes", async () => {
    writeContract(projectRoot, "Counter.ts", `
      class Counter {
        public count: number = 0;
        public increment(): void {
          this.count = this.count + 1;
        }
      }
    `);

    const result1 = await compile(projectRoot, defaultConfig);
    expect(result1.success).toBe(true);
    expect(result1.artifacts).toHaveLength(1);

    const cachePath = path.join(projectRoot, "build", ".skittles-cache.json");
    const cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    cache.skittlesVersion = "0.0.0-old";
    fs.writeFileSync(cachePath, JSON.stringify(cache), "utf-8");

    const spy = vi.spyOn(parserModule, "parse");

    const result2 = await compile(projectRoot, defaultConfig);
    expect(result2.success).toBe(true);
    expect(result2.artifacts).toHaveLength(1);

    expect(spy).toHaveBeenCalled();
  });

  it("should invalidate cache when shared type definitions change in another file", async () => {
    writeContract(projectRoot, "types.ts", `
      type Point = {
        x: number;
        y: number;
      };
    `);

    writeContract(projectRoot, "Geometry.ts", `
      class Geometry {
        public origin: Point;
      }
    `);

    const result1 = await compile(projectRoot, defaultConfig);
    expect(result1.success).toBe(true);

    const spy = vi.spyOn(parserModule, "parse");

    writeContract(projectRoot, "types.ts", `
      type Point = {
        x: number;
        y: number;
        z: number;
      };
    `);

    const result2 = await compile(projectRoot, defaultConfig);
    expect(result2.success).toBe(true);

    expect(spy).toHaveBeenCalled();
  });
});
