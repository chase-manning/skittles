// import fs from "fs";
import { readFileSync } from "fs";
import getAst from "../lib/get-ast";

describe("Yul Compile", () => {
  it("should match expected", async () => {
    const response = getAst("./contracts/hello-world.ts");
    expect(response).not.toBeUndefined();
    expect(response!.end).toBe(146);
    expect(readFileSync("./__tests__/meow.bin")).toEqual(
      readFileSync("./__tests__/expected/HelloWorld.bin")
    );
  });
});
