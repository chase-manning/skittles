import { msg } from "../../../src/types/core-types";
import UniswapV2ERC20 from "../uniswap-v2-erc20";

export class UniswapV2TestERC20 extends UniswapV2ERC20 {
  constructor(totalSupply: number) {
    super();
    this._mint(msg.sender, totalSupply);
  }
}
