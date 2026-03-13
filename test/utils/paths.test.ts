import path from "path";
import { describe, expect, it } from "vitest";

import {
  cacheDir,
  cachePath,
  contractsDir,
  outputDir,
  solidityOutputPath,
} from "../../src/utils/paths";

describe("contractsDir", () => {
  it("should join projectRoot with config.contractsDir", () => {
    const result = contractsDir("/project", { contractsDir: "contracts" });
    expect(result).toBe(path.join("/project", "contracts"));
  });

  it("should handle custom contractsDir values", () => {
    const result = contractsDir("/project", { contractsDir: "src/contracts" });
    expect(result).toBe(path.join("/project", "src/contracts"));
  });
});

describe("outputDir", () => {
  it("should join projectRoot with config.outputDir", () => {
    const result = outputDir("/project", { outputDir: "artifacts" });
    expect(result).toBe(path.join("/project", "artifacts"));
  });

  it("should handle custom outputDir values", () => {
    const result = outputDir("/project", { outputDir: "build/output" });
    expect(result).toBe(path.join("/project", "build/output"));
  });
});

describe("cacheDir", () => {
  it("should join projectRoot with config.cacheDir", () => {
    const result = cacheDir("/project", { cacheDir: "cache" });
    expect(result).toBe(path.join("/project", "cache"));
  });

  it("should handle custom cacheDir values", () => {
    const result = cacheDir("/project", { cacheDir: ".cache" });
    expect(result).toBe(path.join("/project", ".cache"));
  });
});

describe("solidityOutputPath", () => {
  it("should join outputDir with solidity subdirectory and filename", () => {
    const result = solidityOutputPath("/project/artifacts", "Token.sol");
    expect(result).toBe(
      path.join("/project/artifacts", "solidity", "Token.sol")
    );
  });

  it("should handle source map filenames", () => {
    const result = solidityOutputPath("/project/artifacts", "Token.sol.map");
    expect(result).toBe(
      path.join("/project/artifacts", "solidity", "Token.sol.map")
    );
  });
});

describe("cachePath", () => {
  it("should join outputDir with .skittles-cache.json", () => {
    const result = cachePath("/project/cache");
    expect(result).toBe(path.join("/project/cache", ".skittles-cache.json"));
  });
});
