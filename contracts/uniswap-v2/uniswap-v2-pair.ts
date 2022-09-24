import { address } from "../../src/types/core-types";

// TODO Extend the ERC20 contract
// TODO Extend interface
// TODO Add renentrancy protection

interface Reserves {
  reserve0: number;
  reserve1: number;
  blockTimestampLast: number;
}

class UniswapV2Pair {
  readonly MINIMUM_LIQUIDITY: number = 10 ** 3;

  factory: address;
  token0: address;
  token1: address;

  reserve0: number;
  reserve1: number;
  blockTimestampLast: number;

  price0CumulativeLast: number;
  price1CumulativeLast: number;
  kLast: number;

  getReserves(): Reserves {
    return {
      reserve0: this.reserve0,
      reserve1: this.reserve1,
      blockTimestampLast: this.blockTimestampLast,
    };
  }

  initialize(token0: address, token1: address): void {
    this.token0 = token0;
    this.token1 = token1;
  }
}

export default UniswapV2Pair;
