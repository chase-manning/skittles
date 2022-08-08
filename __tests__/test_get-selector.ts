import getSelector from "../lib/get-selector";

import getAbi from "../lib/get-abi";

describe("Get Selector", () => {
  it("should get balance selector for Hello World", async () => {
    const abi = getAbi("./contracts/hello-world.ts");
    const selector = getSelector(abi, "balance", []);
    expect(selector).toBe("0xb69ef8a8");
  });
  it("should get addBalance selector for Hello World", async () => {
    const abi = getAbi("./contracts/hello-world.ts");
    const selector = getSelector(abi, "addBalance", [1]);
    expect(selector).toBe("0xd91921ed");
  });
});
