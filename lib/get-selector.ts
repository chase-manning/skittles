import { utils } from "ethers";

const getSelector = (abi: any[], func: string, params: any[]) => {
  const iface = new utils.Interface(abi);
  const data = iface.encodeFunctionData(func, params);
  return data.substring(0, 10);
};

export default getSelector;
