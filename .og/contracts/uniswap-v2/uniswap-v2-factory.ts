import { ZERO_ADDRESS } from "../../src/data/constants";
import { address, hash } from "../../src/types/core-types";

class UniswapV2Factory {
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
    let [token0, token1] = tokenA > tokenB ? [tokenB, tokenA] : [tokenA, tokenB];
    if (token0 === ZERO_ADDRESS) {
      throw new Error("UniswapV2: ZERO_ADDRESS");
    }
    if (this.getPair[token0][token1] !== ZERO_ADDRESS) {
      throw new Error("UniswapV2: PAIR_EXISTS");
    }
    const salt = hash(token0, token1);
    // const pair = new Uniswa();
    // pair.initialize(token0, token1);
  }
}

export default UniswapV2Factory;
