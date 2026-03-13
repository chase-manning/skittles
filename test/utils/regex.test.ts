import { describe, expect,it } from "vitest";

import { findExtendsReferences } from "../../src/utils/regex";

describe("findExtendsReferences", () => {
  it("should extract a single extends reference", () => {
    const source = "class MyToken extends ERC20 {}";
    expect(findExtendsReferences(source)).toEqual(["ERC20"]);
  });

  it("should extract multiple extends references", () => {
    const source = `
      class MyToken extends ERC20 {}
      class MyNFT extends ERC721 {}
    `;
    expect(findExtendsReferences(source)).toEqual(["ERC20", "ERC721"]);
  });

  it("should return an empty array when there are no extends clauses", () => {
    const source = "class MyContract {}";
    expect(findExtendsReferences(source)).toEqual([]);
  });

  it("should handle extra whitespace between extends and class name", () => {
    const source = "class MyToken extends   ERC20 {}";
    expect(findExtendsReferences(source)).toEqual(["ERC20"]);
  });

  it("should handle empty source", () => {
    expect(findExtendsReferences("")).toEqual([]);
  });
});
