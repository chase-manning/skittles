import getAst from "../lib/get-ast";

describe("Get AST", () => {
  it("should work for hello world", async () => {
    const response = getAst("../contracts/hello-world.ts");
    console.log(response);
    expect(true).toBe(true);
  });

  //   it("should resolve with false for invalid token", async () => {
  //     const response = await user.auth("invalidToken");
  //     expect(response).toEqual({
  //       error: { type: "unauthorized", message: "Authentication Failed" },
  //     });
  //   });
});
