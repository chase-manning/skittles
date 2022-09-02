import { address } from "../../src/types/core-types";

// TODO Add events
// TODO Refactor token assignments to use conditional expressions a ? b : c
// TODO Increase line length and refactor to assing token0 and token1 at the same time

export class UniswapV2Factory {
  feeTo: address;
  feeToSetter: address;

  getPair: Record<address, Record<address, address>>;
  allPairs: address[];

  constructor(feeToSetter: address) {
    this.feeToSetter = feeToSetter;
  }

  allPairsLength(): number {
    return this.allPairs.length;
  }

  createPair(tokenA: address, tokenB: address): void {
    if (tokenA === tokenB) {
      throw new Error("UniswapV2: IDENTICAL_ADDRESSES");
    }
    let token0 = tokenA;
    let token1 = tokenB;
    if (tokenA > tokenB) {
      token0 = tokenB;
      token1 = tokenA;
    }
  }
}
