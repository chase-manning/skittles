import { ZERO_ADDRESS } from "../../src/data/constants";
import { address, SkittlesContract } from "../../src/types/core-types";
// import UniswapV2Pair from "./uniswap-v2-pair";

class UniswapV2Factory extends SkittlesContract {
  feeTo: address;
  feeToSetter: address;

  getPair: Record<address, Record<address, address>>;
  allPairs: address[];

  constructor(feeToSetter: address) {
    super();
    this.feeToSetter = feeToSetter;
  }

  allPairsLength(): number {
    return this.allPairs.length;
  }

  createPair(tokenA: address, tokenB: address): void {
    if (tokenA === tokenB) {
      throw new Error("UniswapV2: IDENTICAL_ADDRESSES");
    }
    let [token0, token1] = tokenA > tokenB ? [tokenB, tokenA] : [tokenA, tokenB];
    if (token0 === ZERO_ADDRESS) {
      throw new Error("UniswapV2: ZERO_ADDRESS");
    }
    if (this.getPair[token0][token1] !== ZERO_ADDRESS) {
      throw new Error("UniswapV2: PAIR_EXISTS");
    }
    // const pair = new UniswapV2Pair();
    // pair.initialize(token0, token1);
  }
}

export default UniswapV2Factory;
