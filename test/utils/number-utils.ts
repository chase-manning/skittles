import { BigNumber } from "ethers";

export const scale = (
  value: number | string,
  decimals: number = 18
): BigNumber => {
  return BigNumber.from(value).mul(BigNumber.from(10).pow(decimals));
};

export const MAX_UINT256 = BigNumber.from(2).pow(256).sub(1);
