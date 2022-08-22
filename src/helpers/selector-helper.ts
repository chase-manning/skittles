import { utils } from "ethers";
import { AbiParameter } from "../types/abi-types";

const exampleValues: Record<string, any> = {
  uint256: 1,
  bool: true,
  string: "hello",
  address: "0x1234567890123456789012345678901234567890",
};

const getSelector = (abi: any[], func: string) => {
  const iface = new utils.Interface(abi);
  const abiFunction = abi.find((f) => f.name === func);
  if (!abiFunction) throw new Error(`Could not find function ${func}`);
  const params = abiFunction.inputs.map(
    (input: AbiParameter) => exampleValues[input.type]
  );
  const data = iface.encodeFunctionData(func, params);
  return data.substring(0, 10);
};

export default getSelector;
