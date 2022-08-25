import { address } from "../../src/types/core-types";

export class UniswapV2ERC20 {
  readonly name: string = "Uniswap V2";
  readonly symbol: string = "UNI-V2";
  readonly decimals: number = 18;
  totalSupply: number;
  balanceOf: Record<address, number>;
  allownace: Record<address, Record<address, number>>;
}
