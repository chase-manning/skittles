import { address } from "../../src/types/core-types";

// TODO Add events
// TODO Increase line length and refactor to assing token0 and token1 at the same time
// TODO Change to using ZERO_ADDRESS import

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
    let token0 = tokenA > tokenB ? tokenB : tokenA;
    let token1 = tokenA > tokenB ? tokenA : tokenB;
    if (token0 === "0x0000000000000000000000000000000000000000") {
      throw new Error("UniswapV2: ZERO_ADDRESS");
    }
    if (
      this.getPair[token0][token1] !==
      "0x0000000000000000000000000000000000000000"
    ) {
      throw new Error("UniswapV2: PAIR_EXISTS");
    }
    // const pair = new UniswapV2Pair();
    // pair.initialize(token0, token1);
  }
}
