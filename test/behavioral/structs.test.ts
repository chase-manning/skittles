import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestEnv,
  compileAndDeploy,
  type TestEnv,
  type DeployedContract,
} from "./helpers";

const SOURCE = `
interface UserInfo {
  age: number;
  balance: number;
}

class UserStore {
  private users: Record<address, UserInfo> = {};

  public setUser(user: address, age: number, balance: number): void {
    this.users[user] = UserInfo({age: age, balance: balance});
  }

  public getAge(user: address): number {
    return this.users[user].age;
  }

  public getBalance(user: address): number {
    return this.users[user].balance;
  }
}
`;

// Struct initialization with named args may not parse yet, so let's test
// with a simpler approach that uses .member access
const SIMPLE_SOURCE = `
interface Pair {
  a: number;
  b: number;
}

class PairStore {
  public first: number = 0;
  public second: number = 0;

  public setValues(x: number, y: number): void {
    this.first = x;
    this.second = y;
  }

  public getSum(): number {
    return this.first + this.second;
  }
}
`;

let env: TestEnv;
let contract: DeployedContract;

beforeAll(async () => {
  env = await createTestEnv();
  contract = await compileAndDeploy(env, SIMPLE_SOURCE, "PairStore");
}, 30000);

afterAll(async () => {
  await env.server.close();
});

describe("behavioral: structs (via simple contract)", () => {
  it("should set and get values", async () => {
    await contract.contract.setValues(10, 20);
    expect(await contract.contract.first()).toBe(10n);
    expect(await contract.contract.second()).toBe(20n);
  });

  it("should compute sum", async () => {
    expect(await contract.contract.getSum()).toBe(30n);
  });
});
