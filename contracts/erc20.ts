import { Address } from "../src/types/core-types";

export class ERC20 {
  decimals: number;
  owner: Address = "0x00000000006c3852cbEf3e08E8dF289169EdE581";

  totalSupply: number = 0;

  constructor(decimals_: number) {
    this.decimals = decimals_;
  }
}
