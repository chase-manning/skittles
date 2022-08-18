export class ERC20 {
  decimals: number;

  totalSupply: number = 0;

  constructor(decimals_: number) {
    this.decimals = decimals_;
  }
}
