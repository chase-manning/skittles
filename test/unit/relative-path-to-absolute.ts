import { expect } from "chai";
import { relativePathToAbsolute } from "../../src/helpers/file-helper";

describe("Relative Path to Absolute", () => {
  it("Should convert", async () => {
    const cases: [string, string, string][] = [
      [
        "../types/skittles-contract",
        "/Users/username/Projects/skittles/src/abi/get-abi.ts",
        "/Users/username/Projects/skittles/src/types/skittles-contract.ts",
      ],
      [
        "../../src/types/core-types",
        "/Users/username/Projects/skittles/contracts/regression-test/regression-test.ts",
        "/Users/username/Projects/skittles/src/types/core-types.ts",
      ],
      [
        "./regression-test-interface",
        "/Users/username/Projects/skittles/contracts/regression-test/regression-test.ts",
        "/Users/username/Projects/skittles/contracts/regression-test/regression-test-interface.ts",
      ],
      [
        "../uniswap-v2-erc20",
        "/Users/username/Projects/skittles/contracts/uniswap-v2/test/uniswap-v2-test-erc20.ts",
        "/Users/username/Projects/skittles/contracts/uniswap-v2/uniswap-v2-erc20.ts",
      ],
      [
        "./interfaces/uniswap-v2-erc20-interface",
        "/Users/username/Projects/skittles/contracts/uniswap-v2/uniswap-v2-erc20.ts",
        "/Users/username/Projects/skittles/contracts/uniswap-v2/interfaces/uniswap-v2-erc20-interface.ts",
      ],
    ];
    cases.forEach(([path, source, expected]) => {
      expect(relativePathToAbsolute(path, source)).to.equal(expected);
    });
  });
});
