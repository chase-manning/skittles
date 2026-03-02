import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { type TestEnv, createTestEnv, compileAndDeploy } from "./helpers";

describe("Array Methods (behavioral)", () => {
  let env: TestEnv;

  beforeAll(async () => {
    env = await createTestEnv();
  }, 30_000);

  afterAll(async () => {
    await env.server.close();
  });

  // ============================================================
  // includes
  // ============================================================

  it("includes: returns true when value exists", async () => {
    const source = `
      class ArrayTest {
        private items: number[] = [];

        public addItem(value: number): void {
          this.items.push(value);
        }

        public hasItem(value: number): boolean {
          return this.items.includes(value);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ArrayTest");
    await (await contract.addItem(10)).wait();
    await (await contract.addItem(20)).wait();
    await (await contract.addItem(30)).wait();
    expect(await contract.hasItem(20)).toBe(true);
    expect(await contract.hasItem(99)).toBe(false);
  });

  it("includes: works with address arrays", async () => {
    const source = `
      import { address } from "skittles";
      class AddrTest {
        private addrs: address[] = [];

        public add(a: address): void {
          this.addrs.push(a);
        }

        public has(a: address): boolean {
          return this.addrs.includes(a);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "AddrTest");
    const addr1 = await env.accounts[1].getAddress();
    const addr2 = await env.accounts[2].getAddress();
    await (await contract.add(addr1)).wait();
    expect(await contract.has(addr1)).toBe(true);
    expect(await contract.has(addr2)).toBe(false);
  });

  // ============================================================
  // indexOf
  // ============================================================

  it("indexOf: returns index of existing value", async () => {
    const source = `
      class IndexTest {
        private items: number[] = [];

        public addItem(value: number): void {
          this.items.push(value);
        }

        public findItem(value: number): number {
          return this.items.indexOf(value);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "IndexTest");
    await (await contract.addItem(100)).wait();
    await (await contract.addItem(200)).wait();
    await (await contract.addItem(300)).wait();
    expect(await contract.findItem(200)).toBe(1n);
    // Not found returns type(uint256).max
    const notFound = await contract.findItem(999);
    expect(notFound).toBe(BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935"));
  });

  // ============================================================
  // lastIndexOf
  // ============================================================

  it("lastIndexOf: returns last index of value", async () => {
    const source = `
      class LastIndexTest {
        private items: number[] = [];

        public addItem(value: number): void {
          this.items.push(value);
        }

        public findLast(value: number): number {
          return this.items.lastIndexOf(value);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "LastIndexTest");
    await (await contract.addItem(10)).wait();
    await (await contract.addItem(20)).wait();
    await (await contract.addItem(10)).wait();
    expect(await contract.findLast(10)).toBe(2n);
    expect(await contract.findLast(20)).toBe(1n);
  });

  // ============================================================
  // at
  // ============================================================

  it("at: positive index access", async () => {
    const source = `
      class AtTest {
        private items: number[] = [];

        public addItem(value: number): void {
          this.items.push(value);
        }

        public getAt(index: number): number {
          return this.items.at(index);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "AtTest");
    await (await contract.addItem(5)).wait();
    await (await contract.addItem(10)).wait();
    await (await contract.addItem(15)).wait();
    expect(await contract.getAt(0)).toBe(5n);
    expect(await contract.getAt(2)).toBe(15n);
  });

  // ============================================================
  // remove
  // ============================================================

  it("remove: removes first occurrence via swap-and-pop", async () => {
    const source = `
      class RemoveTest {
        private items: number[] = [];

        public addItem(value: number): void {
          this.items.push(value);
        }

        public removeItem(value: number): boolean {
          return this.items.remove(value);
        }

        public getLength(): number {
          return this.items.length;
        }

        public getItem(index: number): number {
          return this.items[index];
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "RemoveTest");
    await (await contract.addItem(10)).wait();
    await (await contract.addItem(20)).wait();
    await (await contract.addItem(30)).wait();
    const result = await contract.removeItem.staticCall(20);
    expect(result).toBe(true);
    await (await contract.removeItem(20)).wait();
    expect(await contract.getLength()).toBe(2n);
    // After swap-and-pop: [10, 30]
    expect(await contract.getItem(0)).toBe(10n);
    expect(await contract.getItem(1)).toBe(30n);
  });

  // ============================================================
  // some
  // ============================================================

  it("some: returns true if any element matches", async () => {
    const source = `
      class SomeTest {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public hasLargeValue(): boolean {
          return this.values.some(v => v > 50);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "SomeTest");
    await (await contract.addValue(10)).wait();
    await (await contract.addValue(20)).wait();
    expect(await contract.hasLargeValue()).toBe(false);
    await (await contract.addValue(100)).wait();
    expect(await contract.hasLargeValue()).toBe(true);
  });

  // ============================================================
  // every
  // ============================================================

  it("every: returns true if all elements match", async () => {
    const source = `
      class EveryTest {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public allPositive(): boolean {
          return this.values.every(v => v > 0);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "EveryTest");
    await (await contract.addValue(10)).wait();
    await (await contract.addValue(20)).wait();
    expect(await contract.allPositive()).toBe(true);
    await (await contract.addValue(0)).wait();
    expect(await contract.allPositive()).toBe(false);
  });

  // ============================================================
  // filter
  // ============================================================

  it("filter: returns filtered array with literal condition", async () => {
    const source = `
      class FilterTest {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getLargeValues(): number[] {
          return this.values.filter(v => v > 10);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "FilterTest");
    await (await contract.addValue(5)).wait();
    await (await contract.addValue(15)).wait();
    await (await contract.addValue(25)).wait();
    await (await contract.addValue(3)).wait();
    const result = await contract.getLargeValues();
    expect(result.length).toBe(2);
    expect(result[0]).toBe(15n);
    expect(result[1]).toBe(25n);
  });

  // ============================================================
  // map
  // ============================================================

  it("map: transforms array elements", async () => {
    const source = `
      class MapTest {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public doubled(): number[] {
          return this.values.map(v => v * 2);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "MapTest");
    await (await contract.addValue(5)).wait();
    await (await contract.addValue(10)).wait();
    await (await contract.addValue(15)).wait();
    const result = await contract.doubled();
    expect(result.length).toBe(3);
    expect(result[0]).toBe(10n);
    expect(result[1]).toBe(20n);
    expect(result[2]).toBe(30n);
  });

  // ============================================================
  // find
  // ============================================================

  it("find: returns first matching element", async () => {
    const source = `
      class FindTest {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public findAbove(): number {
          return this.values.find(v => v > 10);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "FindTest");
    await (await contract.addValue(5)).wait();
    await (await contract.addValue(15)).wait();
    await (await contract.addValue(25)).wait();
    expect(await contract.findAbove()).toBe(15n);
  });

  // ============================================================
  // findIndex
  // ============================================================

  it("findIndex: returns index of first matching element", async () => {
    const source = `
      class FindIndexTest {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public findLargeIndex(): number {
          return this.values.findIndex(v => v > 10);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "FindIndexTest");
    await (await contract.addValue(5)).wait();
    await (await contract.addValue(15)).wait();
    await (await contract.addValue(25)).wait();
    expect(await contract.findLargeIndex()).toBe(1n);
  });

  // ============================================================
  // reduce
  // ============================================================

  it("reduce: accumulates values", async () => {
    const source = `
      class ReduceTest {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public sum(): number {
          return this.values.reduce((acc, v) => acc + v, 0);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ReduceTest");
    await (await contract.addValue(10)).wait();
    await (await contract.addValue(20)).wait();
    await (await contract.addValue(30)).wait();
    expect(await contract.sum()).toBe(60n);
  });

  // ============================================================
  // reverse
  // ============================================================

  it("reverse: reverses array in place", async () => {
    const source = `
      class ReverseTest {
        private items: number[] = [];

        public addItem(value: number): void {
          this.items.push(value);
        }

        public reverseItems(): void {
          this.items.reverse();
        }

        public getItem(index: number): number {
          return this.items[index];
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ReverseTest");
    await (await contract.addItem(1)).wait();
    await (await contract.addItem(2)).wait();
    await (await contract.addItem(3)).wait();
    await (await contract.reverseItems()).wait();
    expect(await contract.getItem(0)).toBe(3n);
    expect(await contract.getItem(1)).toBe(2n);
    expect(await contract.getItem(2)).toBe(1n);
  });

  // ============================================================
  // splice
  // ============================================================

  it("splice: removes elements at index", async () => {
    const source = `
      class SpliceTest {
        private items: number[] = [];

        public addItem(value: number): void {
          this.items.push(value);
        }

        public removeAt(index: number): void {
          this.items.splice(index, 1);
        }

        public getLength(): number {
          return this.items.length;
        }

        public getItem(index: number): number {
          return this.items[index];
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "SpliceTest");
    await (await contract.addItem(10)).wait();
    await (await contract.addItem(20)).wait();
    await (await contract.addItem(30)).wait();
    await (await contract.addItem(40)).wait();
    await (await contract.removeAt(1)).wait();
    expect(await contract.getLength()).toBe(3n);
    expect(await contract.getItem(0)).toBe(10n);
    expect(await contract.getItem(1)).toBe(30n);
    expect(await contract.getItem(2)).toBe(40n);
  });

  // ============================================================
  // slice
  // ============================================================

  it("slice: returns sub-array", async () => {
    const source = `
      class SliceTest {
        private items: number[] = [];

        public addItem(value: number): void {
          this.items.push(value);
        }

        public getSlice(start: number, end: number): number[] {
          return this.items.slice(start, end);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "SliceTest");
    await (await contract.addItem(10)).wait();
    await (await contract.addItem(20)).wait();
    await (await contract.addItem(30)).wait();
    await (await contract.addItem(40)).wait();
    const result = await contract.getSlice(1, 3);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(20n);
    expect(result[1]).toBe(30n);
  });

  // ============================================================
  // concat
  // ============================================================

  it("concat: combines arrays", async () => {
    const source = `
      class ConcatTest {
        private items: number[] = [];

        public addItem(value: number): void {
          this.items.push(value);
        }

        public combineWith(other: number[]): number[] {
          return this.items.concat(other);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ConcatTest");
    await (await contract.addItem(1)).wait();
    await (await contract.addItem(2)).wait();
    const result = await contract.combineWith([3, 4, 5]);
    expect(result.length).toBe(5);
    expect(result[0]).toBe(1n);
    expect(result[1]).toBe(2n);
    expect(result[2]).toBe(3n);
    expect(result[3]).toBe(4n);
    expect(result[4]).toBe(5n);
  });

  // ============================================================
  // forEach
  // ============================================================

  it("forEach: iterates and applies side effects", async () => {
    const source = `
      class ForEachTest {
        private values: number[] = [];
        public total: number = 0;

        public addValue(v: number): void {
          this.values.push(v);
        }

        public sumAll(): void {
          this.values.forEach(v => this.total += v);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ForEachTest");
    await (await contract.addValue(10)).wait();
    await (await contract.addValue(20)).wait();
    await (await contract.addValue(30)).wait();
    await (await contract.sumAll()).wait();
    expect(await contract.total()).toBe(60n);
  });
});
