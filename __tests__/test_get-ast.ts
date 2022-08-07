import getAst from "../lib/get-ast";

describe("Get AST", () => {
  it("should work for hello world", async () => {
    const response = getAst("./contracts/hello-world.ts");
    expect(response).not.toBeUndefined();
    expect(response!.end).toBe(146);
  });
});
