import { address } from "../../src/types/core-types";

// TODO Extend the ERC20 contract
// TODO Extend interface
// TODO Add renentrancy protection

export class UniswapV2Pair {
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
}
