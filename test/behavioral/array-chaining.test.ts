import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { BEHAVIORAL_TIMEOUT } from "../constants";
import { compileAndDeploy, createTestEnv, type TestEnv } from "./helpers";

describe("Array Chaining (behavioral)", () => {
  let env: TestEnv;

  beforeAll(async () => {
    env = await createTestEnv();
  }, BEHAVIORAL_TIMEOUT);

  afterAll(async () => {
    await env.server.close();
  });

  // ============================================================
  // filter → filter
  // ============================================================

  it("chain: filter then filter", async () => {
    const source = `
      class ChainFilterFilter {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getFiltered(): number[] {
          return this.values.filter(v => v > 2).filter(v => v < 5);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterFilter");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    await (await contract.addValue(5)).wait();
    const result = await contract.getFiltered();
    expect(result.length).toBe(2);
    expect(result[0]).toBe(3n);
    expect(result[1]).toBe(4n);
  });

  // ============================================================
  // filter → map
  // ============================================================

  it("chain: filter then map", async () => {
    const source = `
      class ChainFilterMap {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getTransformed(): number[] {
          return this.values.filter(v => v > 2).map(v => v * 10);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterMap");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    const result = await contract.getTransformed();
    expect(result.length).toBe(2);
    expect(result[0]).toBe(30n);
    expect(result[1]).toBe(40n);
  });

  // ============================================================
  // filter → includes
  // ============================================================

  it("chain: filter then includes", async () => {
    const source = `
      class ChainFilterIncludes {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public filteredHas(target: number): boolean {
          return this.values.filter(v => v > 2).includes(target);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterIncludes");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    expect(await contract.filteredHas(3)).toBe(true);
    expect(await contract.filteredHas(1)).toBe(false);
  });

  // ============================================================
  // filter → some
  // ============================================================

  it("chain: filter then some", async () => {
    const source = `
      class ChainFilterSome {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public filteredHasLarge(): boolean {
          return this.values.filter(v => v > 2).some(v => v > 4);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterSome");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(5)).wait();
    expect(await contract.filteredHasLarge()).toBe(true);
  });

  // ============================================================
  // filter → every
  // ============================================================

  it("chain: filter then every", async () => {
    const source = `
      class ChainFilterEvery {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public allFilteredAboveTwo(): boolean {
          return this.values.filter(v => v > 2).every(v => v > 2);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterEvery");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    await (await contract.addValue(5)).wait();
    expect(await contract.allFilteredAboveTwo()).toBe(true);
  });

  // ============================================================
  // filter → find
  // ============================================================

  it("chain: filter then find", async () => {
    const source = `
      class ChainFilterFind {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public findInFiltered(): number {
          return this.values.filter(v => v > 2).find(v => v > 3);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterFind");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    await (await contract.addValue(5)).wait();
    expect(await contract.findInFiltered()).toBe(4n);
  });

  // ============================================================
  // filter → findIndex
  // ============================================================

  it("chain: filter then findIndex", async () => {
    const source = `
      class ChainFilterFindIndex {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public findIndexInFiltered(): number {
          return this.values.filter(v => v > 2).findIndex(v => v > 4);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterFindIndex");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    await (await contract.addValue(5)).wait();
    // After filter: [3, 4, 5]. findIndex(v > 4) → index 2
    expect(await contract.findIndexInFiltered()).toBe(2n);
  });

  // ============================================================
  // filter → reduce
  // ============================================================

  it("chain: filter then reduce", async () => {
    const source = `
      class ChainFilterReduce {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public sumFiltered(): number {
          return this.values.filter(v => v > 2).reduce((acc, v) => acc + v, 0);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterReduce");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    await (await contract.addValue(5)).wait();
    // After filter(>2): [3, 4, 5], sum = 12
    expect(await contract.sumFiltered()).toBe(12n);
  });

  // ============================================================
  // map → filter
  // ============================================================

  it("chain: map then filter", async () => {
    const source = `
      class ChainMapFilter {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getResult(): number[] {
          return this.values.map(v => v * 2).filter(v => v > 5);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainMapFilter");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    // map(*2): [2, 4, 6, 8], filter(>5): [6, 8]
    const result = await contract.getResult();
    expect(result.length).toBe(2);
    expect(result[0]).toBe(6n);
    expect(result[1]).toBe(8n);
  });

  // ============================================================
  // map → map
  // ============================================================

  it("chain: map then map", async () => {
    const source = `
      class ChainMapMap {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getResult(): number[] {
          return this.values.map(v => v * 2).map(v => v + 1);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainMapMap");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    // map(*2): [2, 4, 6], map(+1): [3, 5, 7]
    const result = await contract.getResult();
    expect(result.length).toBe(3);
    expect(result[0]).toBe(3n);
    expect(result[1]).toBe(5n);
    expect(result[2]).toBe(7n);
  });

  // ============================================================
  // map → reduce
  // ============================================================

  it("chain: map then reduce", async () => {
    const source = `
      class ChainMapReduce {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public sumDoubled(): number {
          return this.values.map(v => v * 2).reduce((acc, v) => acc + v, 0);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainMapReduce");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    // map(*2): [2, 4, 6], reduce(sum): 12
    expect(await contract.sumDoubled()).toBe(12n);
  });

  // ============================================================
  // map → includes
  // ============================================================

  it("chain: map then includes", async () => {
    const source = `
      class ChainMapIncludes {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public doubledHas(target: number): boolean {
          return this.values.map(v => v * 2).includes(target);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainMapIncludes");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    // map(*2): [2, 4, 6]
    expect(await contract.doubledHas(4)).toBe(true);
    expect(await contract.doubledHas(3)).toBe(false);
  });

  // ============================================================
  // slice → filter
  // ============================================================

  it("chain: slice then filter", async () => {
    const source = `
      class ChainSliceFilter {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getResult(): number[] {
          return this.values.slice(1, 4).filter(v => v > 3);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainSliceFilter");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    await (await contract.addValue(5)).wait();
    // slice(1,4): [2, 3, 4], filter(>3): [4]
    const result = await contract.getResult();
    expect(result.length).toBe(1);
    expect(result[0]).toBe(4n);
  });

  // ============================================================
  // slice → map
  // ============================================================

  it("chain: slice then map", async () => {
    const source = `
      class ChainSliceMap {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getResult(): number[] {
          return this.values.slice(0, 3).map(v => v * 10);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainSliceMap");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    // slice(0,3): [1, 2, 3], map(*10): [10, 20, 30]
    const result = await contract.getResult();
    expect(result.length).toBe(3);
    expect(result[0]).toBe(10n);
    expect(result[1]).toBe(20n);
    expect(result[2]).toBe(30n);
  });

  // ============================================================
  // filter → filter → filter (triple chain)
  // ============================================================

  it("chain: triple filter", async () => {
    const source = `
      class ChainTripleFilter {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getResult(): number[] {
          return this.values.filter(v => v > 1).filter(v => v < 9).filter(v => v > 4);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainTripleFilter");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(5)).wait();
    await (await contract.addValue(7)).wait();
    await (await contract.addValue(9)).wait();
    // filter(>1): [3,5,7,9], filter(<9): [3,5,7], filter(>4): [5,7]
    const result = await contract.getResult();
    expect(result.length).toBe(2);
    expect(result[0]).toBe(5n);
    expect(result[1]).toBe(7n);
  });

  // ============================================================
  // filter → map → filter (mixed triple chain)
  // ============================================================

  it("chain: filter then map then filter", async () => {
    const source = `
      class ChainFilterMapFilter {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getResult(): number[] {
          return this.values.filter(v => v > 1).map(v => v * 3).filter(v => v < 15);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterMapFilter");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    await (await contract.addValue(5)).wait();
    // filter(>1): [2,3,4,5], map(*3): [6,9,12,15], filter(<15): [6,9,12]
    const result = await contract.getResult();
    expect(result.length).toBe(3);
    expect(result[0]).toBe(6n);
    expect(result[1]).toBe(9n);
    expect(result[2]).toBe(12n);
  });

  // ============================================================
  // filter → sort (chained sort returns array)
  // ============================================================

  it("chain: filter then sort", async () => {
    const source = `
      class ChainFilterSort {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getResult(): number[] {
          return this.values.filter(v => v > 2).sort((a, b) => a - b);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterSort");
    await (await contract.addValue(5)).wait();
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    await (await contract.addValue(2)).wait();
    // filter(>2): [5,3,4], sort(asc): [3,4,5]
    const result = await contract.getResult();
    expect(result.length).toBe(3);
    expect(result[0]).toBe(3n);
    expect(result[1]).toBe(4n);
    expect(result[2]).toBe(5n);
  });

  // ============================================================
  // filter → sort descending
  // ============================================================

  it("chain: filter then sort descending", async () => {
    const source = `
      class ChainFilterSortDesc {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getResult(): number[] {
          return this.values.filter(v => v > 1).sort((a, b) => b - a);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterSortDesc");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(4)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(5)).wait();
    await (await contract.addValue(3)).wait();
    // filter(>1): [4,2,5,3], sort(desc): [5,4,3,2]
    const result = await contract.getResult();
    expect(result.length).toBe(4);
    expect(result[0]).toBe(5n);
    expect(result[1]).toBe(4n);
    expect(result[2]).toBe(3n);
    expect(result[3]).toBe(2n);
  });

  // ============================================================
  // map → sort
  // ============================================================

  it("chain: map then sort", async () => {
    const source = `
      class ChainMapSort {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getResult(): number[] {
          return this.values.map(v => v * 2).sort((a, b) => a - b);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainMapSort");
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    // map(*2): [6,2,4], sort(asc): [2,4,6]
    const result = await contract.getResult();
    expect(result.length).toBe(3);
    expect(result[0]).toBe(2n);
    expect(result[1]).toBe(4n);
    expect(result[2]).toBe(6n);
  });

  // ============================================================
  // filter → reverse (chained reverse returns array)
  // ============================================================

  it("chain: filter then reverse", async () => {
    const source = `
      class ChainFilterReverse {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getResult(): number[] {
          return this.values.filter(v => v > 2).reverse();
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterReverse");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    await (await contract.addValue(5)).wait();
    // filter(>2): [3,4,5], reverse: [5,4,3]
    const result = await contract.getResult();
    expect(result.length).toBe(3);
    expect(result[0]).toBe(5n);
    expect(result[1]).toBe(4n);
    expect(result[2]).toBe(3n);
  });

  // ============================================================
  // filter → forEach
  // ============================================================

  it("chain: filter then forEach", async () => {
    const source = `
      class ChainFilterForEach {
        private values: number[] = [];
        private total: number = 0;

        public addValue(v: number): void {
          this.values.push(v);
        }

        public sumFiltered(): void {
          this.values.filter(v => v > 2).forEach(v => this.total += v);
        }

        public getTotal(): number {
          return this.total;
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterForEach");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    await (await contract.addValue(5)).wait();
    await (await contract.sumFiltered()).wait();
    // filter(>2): [3,4,5], forEach sum: 12
    expect(await contract.getTotal()).toBe(12n);
  });

  // ============================================================
  // Empty array chains
  // ============================================================

  it("chain: filter produces empty array then map", async () => {
    const source = `
      class ChainEmptyFilter {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getResult(): number[] {
          return this.values.filter(v => v > 100).map(v => v * 2);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainEmptyFilter");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    const result = await contract.getResult();
    expect(result.length).toBe(0);
  });

  // ============================================================
  // filter → map → reduce (three-step chain ending with scalar)
  // ============================================================

  it("chain: filter then map then reduce", async () => {
    const source = `
      class ChainFilterMapReduce {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getResult(): number {
          return this.values.filter(v => v > 1).map(v => v * 2).reduce((acc, v) => acc + v, 0);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterMapReduce");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    // filter(>1): [2,3,4], map(*2): [4,6,8], reduce(sum): 18
    expect(await contract.getResult()).toBe(18n);
  });

  // ============================================================
  // filter → map → some
  // ============================================================

  it("chain: filter then map then some", async () => {
    const source = `
      class ChainFilterMapSome {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public hasLargeDoubled(): boolean {
          return this.values.filter(v => v > 2).map(v => v * 2).some(v => v > 8);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterMapSome");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(5)).wait();
    // filter(>2): [3,5], map(*2): [6,10], some(>8): true
    expect(await contract.hasLargeDoubled()).toBe(true);
  });

  // ============================================================
  // slice → filter → map (triple mixed chain)
  // ============================================================

  it("chain: slice then filter then map", async () => {
    const source = `
      class ChainSliceFilterMap {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getResult(): number[] {
          return this.values.slice(1, 4).filter(v => v > 2).map(v => v * 10);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainSliceFilterMap");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    await (await contract.addValue(5)).wait();
    // slice(1,4): [2,3,4], filter(>2): [3,4], map(*10): [30,40]
    const result = await contract.getResult();
    expect(result.length).toBe(2);
    expect(result[0]).toBe(30n);
    expect(result[1]).toBe(40n);
  });

  // ============================================================
  // filter → sort → includes (chain ending with boolean)
  // ============================================================

  it("chain: filter then sort then includes", async () => {
    const source = `
      class ChainFilterSortIncludes {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public sortedFilteredHas(target: number): boolean {
          return this.values.filter(v => v > 2).sort((a, b) => a - b).includes(target);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterSortIncludes");
    await (await contract.addValue(5)).wait();
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    // filter(>2): [5,3,4], sort: [3,4,5]
    expect(await contract.sortedFilteredHas(3)).toBe(true);
    expect(await contract.sortedFilteredHas(1)).toBe(false);
  });

  // ============================================================
  // Single element chain
  // ============================================================

  it("chain: single element filter and map", async () => {
    const source = `
      class ChainSingleElement {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getResult(): number[] {
          return this.values.filter(v => v == 3).map(v => v * 100);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainSingleElement");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    const result = await contract.getResult();
    expect(result.length).toBe(1);
    expect(result[0]).toBe(300n);
  });

  // ============================================================
  // map → every
  // ============================================================

  it("chain: map then every", async () => {
    const source = `
      class ChainMapEvery {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public allDoubledAboveFive(): boolean {
          return this.values.map(v => v * 2).every(v => v > 5);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainMapEvery");
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    await (await contract.addValue(5)).wait();
    // map(*2): [6,8,10], every(>5): true
    expect(await contract.allDoubledAboveFive()).toBe(true);
  });

  // ============================================================
  // filter → slice
  // ============================================================

  it("chain: filter then slice", async () => {
    const source = `
      class ChainFilterSlice {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public getResult(): number[] {
          return this.values.filter(v => v > 1).slice(0, 2);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFilterSlice");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    await (await contract.addValue(5)).wait();
    // filter(>1): [2,3,4,5], slice(0,2): [2,3]
    const result = await contract.getResult();
    expect(result.length).toBe(2);
    expect(result[0]).toBe(2n);
    expect(result[1]).toBe(3n);
  });

  // ============================================================
  // filter → map → sort → includes (four-step chain)
  // ============================================================

  it("chain: four-step filter → map → sort → includes", async () => {
    const source = `
      class ChainFourStep {
        private values: number[] = [];

        public addValue(v: number): void {
          this.values.push(v);
        }

        public check(target: number): boolean {
          return this.values.filter(v => v > 1).map(v => v * 3).sort((a, b) => a - b).includes(target);
        }
      }
    `;
    const { contract } = await compileAndDeploy(env, source, "ChainFourStep");
    await (await contract.addValue(1)).wait();
    await (await contract.addValue(2)).wait();
    await (await contract.addValue(3)).wait();
    await (await contract.addValue(4)).wait();
    // filter(>1): [2,3,4], map(*3): [6,9,12], sort: [6,9,12]
    expect(await contract.check(9)).toBe(true);
    expect(await contract.check(3)).toBe(false);
  });
});
