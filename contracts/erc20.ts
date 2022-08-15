export class ERC20 {
  totalSupply: number = 0;
  decimals: number;

  constructor(decimals_: number) {
    this.decimals = decimals_;
  }
}
