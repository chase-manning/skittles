import getAst from "../lib/get-ast";

describe("Get AST", () => {
  it("should work for hello world", async () => {
    const response = getAst("./contracts/hello-world.ts");
    expect(response).not.toBeUndefined();
    console.log(response);
    expect(response!.end).toBe(138);
  });
});
