import { msg } from "../../src/types/core-types";
import { ERC20 } from "./erc20";

export class MockERC20 extends ERC20 {
  constructor(mintAmount_: number) {
    super();
    this.balanceOf[msg.sender] = mintAmount_;
    this.totalSupply = mintAmount_;
  }
}
