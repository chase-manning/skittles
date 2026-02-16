import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestEnv,
  compileAndDeploy,
  type TestEnv,
  type DeployedContract,
} from "./helpers";

const SOURCE = `
class ControlFlow {
  public bitwiseAnd(a: number, b: number): number {
    return a & b;
  }

  public bitwiseOr(a: number, b: number): number {
    return a | b;
  }

  public bitwiseXor(a: number, b: number): number {
    return a ^ b;
  }

  public leftShift(a: number, bits: number): number {
    return a << bits;
  }

  public rightShift(a: number, bits: number): number {
    return a >> bits;
  }

  public bitwiseNot(a: number): number {
    return ~a;
  }

  public findFirstMatch(target: number): number {
    for (let i: number = 0; i < 100; i++) {
      if (i === target) {
        return i;
      }
    }
    return 999;
  }

  public sumOdds(n: number): number {
    let total: number = 0;
    for (let i: number = 0; i < n; i++) {
      if (i % 2 === 0) {
        continue;
      }
      total += i;
    }
    return total;
  }

  public findWithBreak(target: number): number {
    let result: number = 0;
    for (let i: number = 0; i < 100; i++) {
      if (i === target) {
        result = i;
        break;
      }
    }
    return result;
  }

  public doWhileCountdown(n: number): number {
    let i: number = n;
    do {
      i -= 1;
    } while (i > 0);
    return i;
  }

  public multiVar(): number {
    let a: number = 10, b: number = 20, c: number = 30;
    return a + b + c;
  }
}
`;

let env: TestEnv;
let contract: DeployedContract;

beforeAll(async () => {
  env = await createTestEnv();
  contract = await compileAndDeploy(env, SOURCE, "ControlFlow");
}, 30000);

afterAll(async () => {
  await env.server.close();
});

describe("behavioral: bitwise operators", () => {
  it("AND: 0xFF & 0x0F = 0x0F", async () => {
    expect(await contract.contract.bitwiseAnd(0xFF, 0x0F)).toBe(15n);
  });

  it("OR: 0xF0 | 0x0F = 0xFF", async () => {
    expect(await contract.contract.bitwiseOr(0xF0, 0x0F)).toBe(255n);
  });

  it("XOR: 0xFF ^ 0x0F = 0xF0", async () => {
    expect(await contract.contract.bitwiseXor(0xFF, 0x0F)).toBe(240n);
  });

  it("left shift: 1 << 8 = 256", async () => {
    expect(await contract.contract.leftShift(1, 8)).toBe(256n);
  });

  it("right shift: 256 >> 4 = 16", async () => {
    expect(await contract.contract.rightShift(256, 4)).toBe(16n);
  });
});

describe("behavioral: break and continue", () => {
  it("continue skips even numbers, sums odds below 10", async () => {
    expect(await contract.contract.sumOdds(10)).toBe(25n);
  });

  it("break exits loop at target", async () => {
    expect(await contract.contract.findWithBreak(7)).toBe(7n);
  });

  it("findFirstMatch returns target via early return", async () => {
    expect(await contract.contract.findFirstMatch(42)).toBe(42n);
  });
});

describe("behavioral: do-while", () => {
  it("counts down from 5 to 0", async () => {
    expect(await contract.contract.doWhileCountdown(5)).toBe(0n);
  });

  it("counts down from 1 to 0", async () => {
    expect(await contract.contract.doWhileCountdown(1)).toBe(0n);
  });
});

describe("behavioral: multiple variable declarations", () => {
  it("let a=10, b=20, c=30; returns 60", async () => {
    expect(await contract.contract.multiVar()).toBe(60n);
  });
});
